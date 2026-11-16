/**
 * 编译期桩：ctb 的 Grid/GlobalGeodetic 只在「判断数据集 SRS 是否与网格 SRS 相同」
 * 时用到 OGRSpatialReference。WASM 版固定 EPSG:4326 网格、不做重投影，
 * 因此只需要 IsSame 恒为 true 的占位实现。
 */
#ifndef WASM_STUB_OGR_SPATIALREF_H
#define WASM_STUB_OGR_SPATIALREF_H
#define GDAL_VERSION_MAJOR 3
#define OAMS_TRADITIONAL_GIS_ORDER 0
class OGRSpatialReference {
public:
  OGRSpatialReference() {}
  bool IsSame(const OGRSpatialReference *) const { return true; }
  void SetAxisMappingStrategy(int) {}
  int importFromEPSG(int) { return 0; }
};
#endif
