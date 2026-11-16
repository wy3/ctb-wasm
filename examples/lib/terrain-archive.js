import { gunzipSync, strToU8, zipSync } from 'fflate'

const TILE_SIZE = 65
const TILE_INTERVALS = TILE_SIZE - 1
const HEIGHT_COUNT = TILE_SIZE * TILE_SIZE

function getTileRange (bounds, zoom) {
  const [west, south, east, north] = bounds
  const columns = 2 ** (zoom + 1)
  const rows = 2 ** zoom
  const tileWidth = 360 / columns
  const tileHeight = 180 / rows

  return {
    startX: Math.max(0, Math.floor((west + 180) / tileWidth)),
    endX: Math.min(columns - 1, Math.ceil((east + 180) / tileWidth) - 1),
    startY: Math.max(0, Math.floor((south + 90) / tileHeight)),
    endY: Math.min(rows - 1, Math.ceil((north + 90) / tileHeight) - 1),
    columns,
    rows,
    tileWidth,
    tileHeight,
  }
}

function createElevationGrid (imageInfo, zoom, x, y) {
  const { columns, rows, tileWidth, tileHeight } = getTileRange(imageInfo.bounds, zoom)
  const heights = new Float32Array(HEIGHT_COUNT)
  const minCenterX = imageInfo.originX + imageInfo.resolutionX / 2
  const maxCenterX = imageInfo.originX + imageInfo.resolutionX * (imageInfo.width - 0.5)
  const minCenterY = imageInfo.originY + imageInfo.resolutionY * (imageInfo.height - 0.5)
  const maxCenterY = imageInfo.originY + imageInfo.resolutionY / 2

  if (x < 0 || x >= columns || y < 0 || y >= rows) {
    throw new RangeError(`Tile coordinate out of range at z=${zoom}: x=${x}, y=${y}`)
  }

  for (let row = 0; row < TILE_SIZE; row++) {
    const latitude = -90 + (y + (TILE_INTERVALS - row) / TILE_INTERVALS) * tileHeight
    const sampleLatitude = Math.min(maxCenterY, Math.max(minCenterY, latitude))
    const rasterY = Math.floor((sampleLatitude - imageInfo.originY) / imageInfo.resolutionY)

    for (let column = 0; column < TILE_SIZE; column++) {
      const longitude = -180 + (x + column / TILE_INTERVALS) * tileWidth
      const sampleLongitude = Math.min(maxCenterX, Math.max(minCenterX, longitude))
      const rasterX = Math.floor((sampleLongitude - imageInfo.originX) / imageInfo.resolutionX)
      const value = Number(imageInfo.elevations[rasterY * imageInfo.width + rasterX])

      if (!Number.isFinite(value) || (imageInfo.noData !== null && value === imageInfo.noData)) {
        throw new Error(`Invalid elevation at raster pixel x=${rasterX}, y=${rasterY}`)
      }

      heights[row * TILE_SIZE + column] = value
    }
  }

  return heights
}

function encodeTile (wasm, heights, neighborGrids, zoom, x, y) {
  const { ctb_encode_mesh: encode, malloc, free, memory } = wasm
  const allocated = []
  const allocate = (size) => {
    const pointer = malloc(size)
    if (!pointer) throw new Error(`WASM malloc failed for ${size} bytes`)
    allocated.push(pointer)
    return pointer
  }

  try {
    const heightsPtr = allocate(heights.byteLength)
    new Float32Array(memory.buffer, heightsPtr, HEIGHT_COUNT).set(heights)

    const neighborsPtr = allocate(4 * Uint32Array.BYTES_PER_ELEMENT)
    new Uint32Array(memory.buffer, neighborsPtr, 4).fill(0)
    for (let side = 0; side < neighborGrids.length; side++) {
      const neighbor = neighborGrids[side]
      if (!neighbor) continue

      const neighborPtr = allocate(neighbor.byteLength)
      new Float32Array(memory.buffer, neighborPtr, HEIGHT_COUNT).set(neighbor)
      new Uint32Array(memory.buffer, neighborsPtr, 4)[side] = neighborPtr
    }

    const outSizePtr = allocate(Int32Array.BYTES_PER_ELEMENT)
    const outputPtr = encode(heightsPtr, neighborsPtr, TILE_SIZE, zoom, x, y, outSizePtr)
    const outputSize = new Int32Array(memory.buffer, outSizePtr, 1)[0]
    if (!outputPtr || outputSize <= 0) {
      throw new Error(`ctb_encode_mesh returned no bytes for z=${zoom}, x=${x}, y=${y}`)
    }

    const gzipBytes = new Uint8Array(memory.buffer, outputPtr, outputSize)
    return gunzipSync(gzipBytes)
  } finally {
    for (const pointer of allocated.reverse()) free(pointer)
  }
}

/**
 * 将 GeoTIFF 图像采样并编码为包含 layer.json 的 Cesium 地形 ZIP。
 *
 * @param {import('geotiff').GeoTIFFImage} image 已打开的 EPSG:4326 单波段图像
 * @param {WebAssembly.Exports} wasm WASM 实例导出
 * @param {number} maxZoom 最高瓦片级别，范围 0–30
 * @param {(completed: number, total: number) => void} [onProgress] 可选的瓦片进度回调
 * @returns {Promise<Uint8Array>} ZIP 文件字节
 */
export async function createTerrainArchive (image, wasm, maxZoom, onProgress) {
  if (!Number.isInteger(maxZoom) || maxZoom < 0 || maxZoom > 30) {
    throw new RangeError('maxZoom must be an integer from 0 to 30')
  }

  const geoKeys = image.getGeoKeys()
  if (image.getSamplesPerPixel() !== 1) {
    throw new Error('Input GeoTIFF must contain exactly one raster band')
  }
  if (geoKeys.GeographicTypeGeoKey !== 4326) {
    throw new Error('Input GeoTIFF must use EPSG:4326')
  }
  if (!image.pixelIsArea()) {
    throw new Error('Input GeoTIFF must use PixelIsArea raster coordinates')
  }

  const modelTransformation = image.getFileDirectory().ModelTransformation
  if (modelTransformation && (modelTransformation[1] !== 0 || modelTransformation[4] !== 0)) {
    throw new Error('Rotated GeoTIFF images are not supported')
  }

  const [originX, originY] = image.getOrigin()
  const [resolutionX, resolutionY] = image.getResolution()
  if (!(resolutionX > 0 && resolutionY < 0)) {
    throw new Error('Input GeoTIFF must be north-up with positive X and negative Y resolution')
  }

  const bounds = image.getBoundingBox()
  const [west, south, east, north] = bounds
  if (!(west >= -180 && south >= -90 && east <= 180 && north <= 90 && west < east && south < north)) {
    throw new Error('Input GeoTIFF bounds must be a non-empty area inside [-180, 180] × [-90, 90]')
  }

  const width = image.getWidth()
  const height = image.getHeight()
  const [elevations] = await image.readRasters({ samples: [0] })
  if (elevations.length !== width * height) {
    throw new Error('Could not read the first GeoTIFF sample as a single raster band')
  }
  const gdalMetadata = image.getGDALMetadata(0)
  if (gdalMetadata && ('scale' in gdalMetadata || 'offset' in gdalMetadata)) {
    throw new Error('Apply GeoTIFF scale/offset metadata before encoding elevations')
  }

  const imageInfo = {
    bounds,
    originX,
    originY,
    resolutionX,
    resolutionY,
    width,
    height,
    elevations,
    noData: image.getGDALNoData(),
  }
  const ranges = Array.from({ length: maxZoom + 1 }, (_, zoom) => getTileRange(bounds, zoom))
  const totalTiles = ranges.reduce(
    (total, range) => total + (range.endX - range.startX + 1) * (range.endY - range.startY + 1),
    0,
  )
  const files = Object.create(null)
  const available = []
  let completedTiles = 0

  for (let zoom = 0; zoom <= maxZoom; zoom++) {
    const range = ranges[zoom]
    available.push([{
      startX: range.startX,
      startY: range.startY,
      endX: range.endX,
      endY: range.endY,
    }])

    for (let y = range.startY; y <= range.endY; y++) {
      for (let x = range.startX; x <= range.endX; x++) {
        const heights = createElevationGrid(imageInfo, zoom, x, y)
        const neighborGrids = zoom > 6
          ? [
              x > 0 ? createElevationGrid(imageInfo, zoom, x - 1, y) : null,
              y + 1 < range.rows ? createElevationGrid(imageInfo, zoom, x, y + 1) : null,
              x + 1 < range.columns ? createElevationGrid(imageInfo, zoom, x + 1, y) : null,
              y > 0 ? createElevationGrid(imageInfo, zoom, x, y - 1) : null,
            ]
          : [null, null, null, null]

        files[`${zoom}/${x}/${y}.terrain`] =
          encodeTile(wasm, heights, neighborGrids, zoom, x, y)
        completedTiles++

        if (onProgress) {
          onProgress(completedTiles, totalTiles)
          await new Promise((resolve) => setTimeout(resolve, 0))
        }
      }
    }
  }

  const layer = {
    tilejson: '2.1.0',
    format: 'quantized-mesh-1.0',
    version: '1.0.0',
    scheme: 'tms',
    tiles: ['{z}/{x}/{y}.terrain'],
    projection: 'EPSG:4326',
    bounds,
    available,
  }
  files['layer.json'] = strToU8(`${JSON.stringify(layer, null, 2)}\n`)

  return zipSync(files, { level: 6 })
}
