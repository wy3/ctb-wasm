/**
 * ctb 网格编码器的 WASM 入口。
 *
 * 只复用 ctb 中「不依赖 GDAL」的部分：
 *   - MeshTile        quantized-mesh 序列化（zlib 压缩 + oct 法线）
 *   - HeightFieldChunker  Chunked-LOD 不规则网格生成
 *   - Grid / GlobalGeodetic  瓦片网格换算
 *
 * 不复用 GDALTiler / GDALDatasetReader —— 它们 160+ 处调用 GDAL 的 warp/VRT API。
 * 本文件用「直接给定 65x65 高程网格」替代 GDAL 的重采样职责：
 * 高程网格由调用方（JS 侧，基于 geotiff.js）按瓦片 bbox 采样好后传入。
 */
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <vector>
#include <map>

#include <zlib.h>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

#include "config.hpp"
#include "MeshTile.hpp"
#include "HeightFieldChunker.hpp"
#include "GlobalGeodetic.hpp"

namespace {

/** 网格边长（65：64 段 + 1 个重叠点，quantized-mesh 规范固定） */
const int TILE_SIZE = 65;
/** 地形高度量化系数：1/5 米（与 ctb TerrainTiler 一致） */
const double TERRAIN_HEIGHT_FACTOR = 5.0;

/**
 * 把高程网格转成不规则三角网（对应 ctb::WrapperMesh 的逻辑）。
 */
class MeshBuilder : public ctb::chunk::mesh {
public:
  MeshBuilder(const ctb::CRSBounds &bounds, ctb::Mesh &mesh, int size)
    : mBounds(bounds), mMesh(mesh), mSize(size),
      mCellSizeX((bounds.getMaxX() - bounds.getMinX()) / double(size - 1)),
      mCellSizeY((bounds.getMaxY() - bounds.getMinY()) / double(size - 1)),
      mTriOddOrder(false), mTriIndex(0) {
    mTriangles[0] = ctb::Coordinate<int>(0, 0);
    mTriangles[1] = ctb::Coordinate<int>(0, 0);
    mTriangles[2] = ctb::Coordinate<int>(0, 0);
  }

  void clear() override {
    mMesh.vertices.clear();
    mMesh.indices.clear();
    mIndicesMap.clear();
    mTriOddOrder = false;
    mTriIndex = 0;
  }

  void emit_vertex(const ctb::chunk::heightfield &heightfield, int x, int y) override {
    mTriangles[mTriIndex].x = x;
    mTriangles[mTriIndex].y = y;
    mTriIndex++;
    if (mTriIndex == 3) {
      mTriOddOrder = !mTriOddOrder;
      if (mTriOddOrder) {
        appendVertex(heightfield, mTriangles[0].x, mTriangles[0].y);
        appendVertex(heightfield, mTriangles[1].x, mTriangles[1].y);
        appendVertex(heightfield, mTriangles[2].x, mTriangles[2].y);
      } else {
        appendVertex(heightfield, mTriangles[1].x, mTriangles[1].y);
        appendVertex(heightfield, mTriangles[0].x, mTriangles[0].y);
        appendVertex(heightfield, mTriangles[2].x, mTriangles[2].y);
      }
      mTriangles[0] = mTriangles[1];
      mTriangles[1] = mTriangles[2];
      mTriIndex--;
    }
  }

  void appendVertex(const ctb::chunk::heightfield &heightfield, int x, int y) {
    const int index = heightfield.indexOfGridCoordinate(x, y);
    std::map<int, int>::iterator it = mIndicesMap.find(index);
    int iv;
    if (it == mIndicesMap.end()) {
      iv = (int)mMesh.vertices.size();
      const double xmin = mBounds.getMinX();
      const double ymax = mBounds.getMaxY();
      const double height = heightfield.height(x, y);
      mMesh.vertices.push_back(ctb::CRSVertex(
        xmin + (x * mCellSizeX), ymax - (y * mCellSizeY), height));
      mIndicesMap.insert(std::make_pair(index, iv));
    } else {
      iv = it->second;
    }
    mMesh.indices.push_back((uint32_t)iv);
  }

private:
  const ctb::CRSBounds &mBounds;
  ctb::Mesh &mMesh;
  int mSize;
  double mCellSizeX, mCellSizeY;
  std::map<int, int> mIndicesMap;
  ctb::Coordinate<int> mTriangles[3];
  bool mTriOddOrder;
  int mTriIndex;
};

/** 输出缓冲区（把 MeshTile 的字节流收集到内存，而不是写文件） */
class MemoryStream : public ctb::CTBOutputStream {
public:
  std::vector<unsigned char> bytes;

  uint32_t write(const void *ptr, uint32_t size) override {
    const unsigned char *p = static_cast<const unsigned char *>(ptr);
    bytes.insert(bytes.end(), p, p + size);
    return size;
  }
};

}  // namespace

#include "gzip_helper.inc"

extern "C" {

/**
 * 生成一块 quantized-mesh 瓦片（gzip 压缩后）。
 *
 * @param heights   65x65 高程（米），行优先，西北角起始
 * @param neighbors 4 个邻居的 65x65 高程指针（0=左 1=上 2=右 3=下，nullptr 表示无邻居），
 *                  用于边界误差传播（缺这一步相邻瓦片接缝会出现裂缝）；传 NULL 表示全部不做
 * @param tileSize  网格边长（必须为 65）
 * @param z,x,y     TMS 瓦片坐标（GlobalGeodetic 网格）
 * @param outSize   输出字节数（含 gzip 头）
 * @returns 指向内部缓冲区的指针（下一次调用会失效）；失败返回 NULL
 */
unsigned char *ctb_encode_mesh(const float *heights, const float *const *neighbors,
                               int tileSize, int z, int x, int y, int *outSize) {
  if (outSize) *outSize = 0;
  if (!heights || tileSize != TILE_SIZE) return NULL;

  ctb::GlobalGeodetic grid(TILE_SIZE, true);
  ctb::TileCoordinate coord((ctb::i_zoom)z, (ctb::i_tile)x, (ctb::i_tile)y);
  const ctb::CRSBounds tileBounds = grid.tileBounds(coord);

  ctb::MeshTile tile(coord);

  // 几何误差：与 ctb::MeshTiler::prepareSettingsOfTile 相同的公式
  const double resolutionAtLevelZero = grid.resolution(0);
  const int numberOfTilesAtLevelZero =
    (int)(grid.getExtent().getWidth() / (tileSize * resolutionAtLevelZero));
  const double heightmapTerrainQuality = 0.25;
  const double semiMajorAxis = 6378137.0;
  double maximumGeometricError =
    (semiMajorAxis * 2 * M_PI * heightmapTerrainQuality) /
    (double)(tileSize * numberOfTilesAtLevelZero);
  maximumGeometricError /= (double)(1 << z);

  std::vector<float> grid1(heights, heights + tileSize * tileSize);
  ctb::chunk::heightfield heightfield(grid1.data(), tileSize);
  heightfield.applyGeometricError(maximumGeometricError, z <= 6);

  // 邻居边界误差传播：与 ctb::MeshTiler::prepareSettingsOfTile 一致。
  // 不做这一步会导致相邻瓦片接缝处的网格密度不一致，出现裂缝。
  // neighborHeights 由调用方提供（JS 侧采样相邻瓦片后传入），第 i 块对应
  // borderIndex i（0=左 1=上 2=右 3=下），nullptr 表示该侧没有邻居。
  if (z > 6) {
    for (int borderIndex = 0; borderIndex < 4; borderIndex++) {
      const float *nb = neighbors[borderIndex];
      if (!nb) continue;
      std::vector<float> nbGrid(nb, nb + tileSize * tileSize);
      ctb::chunk::heightfield neighborHeightfield(nbGrid.data(), tileSize);
      neighborHeightfield.applyGeometricError(maximumGeometricError);
      heightfield.applyBorderActivationState(neighborHeightfield, borderIndex);
    }
  }

  ctb::Mesh &mesh = tile.getMesh();
  MeshBuilder builder(tileBounds, mesh, tileSize);
  heightfield.generateMesh(builder, 0);

  // 子瓦片标志：整块瓦片都在数据集范围内（调用方保证），全部置位
  if (z != 32) {  // 非最高级
    tile.setChildSW();
    tile.setChildSE();
    tile.setChildNW();
    tile.setChildNE();
  }

  static std::vector<unsigned char> buffer;
  buffer.clear();
  MemoryStream stream;
  tile.writeFile(stream, true);

  // gzip 压缩（与 ctb 的 gzopen/gzwrite 输出格式一致）
  if (!gzipCompress(stream.bytes, buffer)) {
    buffer.clear();
    return NULL;
  }
  if (outSize) *outSize = (int)buffer.size();
  return buffer.data();
}

}  // extern "C"
