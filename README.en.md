# ctb-wasm

[简体中文](README.md)

Builds the height-grid encoder from Cesium Terrain Builder as WebAssembly and
produces Cesium quantized-mesh terrain tiles. The core module handles
**65×65 height grids → quantized-mesh data**. An [end-to-end example](examples/geotiff-to-zip.mjs) is
also provided for converting an EPSG:4326 GeoTIFF into a Cesium terrain ZIP archive.

## Quick start

Building the WASM requires Zig 0.14.0 and Bash. The CTB source and zlib 1.3.1
are included, so no download is needed for the WASM build.

```bash
./build.sh
node test/smoke.cjs
```

The build output is `dist/ctb_mesh.wasm`. On Windows, run the commands from
Git Bash or MSYS2 Bash. If Zig is not on `PATH`, set `ZIG` to its executable
using an MSYS-style path.

## Web demo

```bash
cd examples
npm install
npm run dev:web
```

The Chinese page is at `/` and the English page is at `/en.html`. Choose a
GeoTIFF in the browser and download the terrain ZIP. See the
[build guide](docs/BUILD.en.md) for input limits and the full workflow.

## WASM interface

The module exports `ctb_encode_mesh`, `malloc`, `free`, and `memory`. Encoding
accepts a 65×65 `float32` elevation grid in meters (row-major, starting at the
northwest) and a four-entry neighbor pointer array in WASM memory, ordered west,
north, east, south; use `0` for a missing neighbor.
Coordinates use the GlobalGeodetic / TMS scheme, with `y` increasing northward.
Instantiation also requires `fd_close`, `fd_seek`, `fd_write`, and `proc_exit`
imports under `wasi_snapshot_preview1`.

The returned pointer references an internal buffer containing gzip-compressed
quantized-mesh data. Copy the bytes before the next encode call. If serving
`.terrain` files directly from a static server without gzip content encoding,
decompress the payload first. See the [English build guide](docs/BUILD.en.md)
for the full ABI, memory-lifetime rules, and the GeoTIFF-to-terrain-ZIP example.

## Provenance and licensing

The upstream CTB source, pinned commit, and local patch are recorded in
[upstream-revision.txt](upstream-revision.txt). Apache-2.0 is selected for
project-authored code; the bundled CTB and zlib components retain their
respective upstream licenses. See [LICENSES.md](LICENSES.md) for scope and
third-party notices.

Suggested hosting-site metadata is in
[REPOSITORY_DESCRIPTION.md](docs/REPOSITORY_DESCRIPTION.md).
