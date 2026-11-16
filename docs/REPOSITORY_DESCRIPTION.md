# 仓库简介与 Topics / Repository description and topics

## GitHub Description（推荐）

> WebAssembly encoder for Cesium quantized-mesh terrain, with browser and Node.js GeoTIFF-to-ZIP examples.

## 中文简介

> 基于 Cesium Terrain Builder 的 WebAssembly 地形编码器，提供浏览器和 Node.js GeoTIFF 到 Cesium quantized-mesh ZIP 的示例。

## GitHub Topics

`cesium`, `cesium-terrain`, `cesium-terrain-builder`, `quantized-mesh`, `terrain`, `terrain-tiles`, `geotiff`, `geospatial`, `webassembly`, `wasm`, `zig`, `tms`

## 仓库设置 / Repository settings

- Repository: `wy3/ctb-wasm`
- Default branch: `master`
- License: Apache-2.0 for project-authored code; retain the bundled CTB and zlib notices.
- The WASM encoder is the core component. GeoTIFF reading and ZIP packaging are demonstrated by the examples, not part of the encoder ABI.
- ZIP packaging in the examples is performed in the browser or Node.js with `fflate`; no server-side upload service is included.
