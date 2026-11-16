# Build guide

[简体中文版](BUILD.zh-CN.md)

## What is built

The build script compiles the compression/decompression sources from zlib 1.3.1
and the encoding-side CTB `MeshTile` and `GlobalGeodetic` code to WebAssembly.
The WASM encoder itself does not handle GDAL I/O, GeoTIFF processing,
resampling, or file output; the repository also includes a limited Node.js
GeoTIFF-to-ZIP example.

## Requirements

- Zig **0.14.0**, with the `wasm32-wasi` target available.
- Bash (Linux/macOS Bash, Git Bash, or MSYS2 Bash).
- Node.js and npm (for the smoke test or the GeoTIFF conversion example).
- The web demo uses Vite 8 and requires Node.js `^20.19.0` or `>=22.12.0`.

The pinned CTB source and zlib 1.3.1 are included, so building does not require
network access.

## Build

Run from the repository root:

```bash
./build.sh
```

If Zig is not on `PATH`, set `ZIG`:

```bash
ZIG=/c/tools/zig/zig.exe ./build.sh
```

PowerShell example on Windows (replace the paths with your local installation):

```powershell
& 'C:\msys64\usr\bin\bash.exe' -lc `
  'cd /f/path/to/ctb-wasm && ZIG=/c/tools/zig/zig.exe ./build.sh'
```

The script uses a temporary directory for object files and removes it on exit.
On success it creates or overwrites `dist/ctb_mesh.wasm`. A prebuilt module is
included, so most users do not need to rebuild it.

## Web demo

Start the local example from the repository root:

```bash
cd examples
npm install
npm run dev:web
```

Open the local URL printed by Vite, choose a GeoTIFF, and set the maximum zoom.
The page generates and downloads the ZIP in the browser; it does not upload the
input file. GeoTIFF decoding, WASM encoding, and ZIP packaging all run locally.
The English page is at `/en.html`; the default `/` page is in Chinese.
To build a static site, run `npm run build:web` from `examples/`; the output is
in `examples/web-dist/`.

The page uses the end-to-end processing flow and input restrictions described
below. It keeps the full raster band and final ZIP in memory, so it is intended
for small or medium datasets; start with a low zoom.

## Verify

Run the smoke test to instantiate the module, encode a flat grid, and validate
the gzip-compressed output:

```bash
node test/smoke.cjs
```

On success, the test prints the compressed and decompressed terrain byte counts.
This confirms basic module execution and output generation; it is not a full
compatibility test for arbitrary DEMs or every browser runtime.

## WASM ABI

The module exports:

- `ctb_encode_mesh(heightsPtr, neighborsPtrsPtr, tileSize, z, x, y, outSizePtr)`
- `malloc(size)`, `free(ptr)`, and `memory`

Instantiation requires the `fd_close`, `fd_seek`, `fd_write`, and `proc_exit`
imports under `wasi_snapshot_preview1`. A browser can provide compatible stub
functions, or use a runtime that supports this WASI ABI.

Parameter contract:

| Parameter | Description |
|---|---|
| `heightsPtr` | 65×65 `float32` elevations in meters, row-major from the northwest |
| `neighborsPtrsPtr` | Four-entry `float32*` pointer array allocated in WASM memory, ordered west, north, east, south; use `0` for a missing neighbor |
| `tileSize` | Must be `65` |
| `z`, `x`, `y` | GlobalGeodetic / TMS tile coordinates; `2^(z+1)` columns and `2^z` rows per level, with `y` increasing northward |
| `outSizePtr` | Pointer to an `int32` where the function writes the compressed byte length |
| Return value | Pointer to an internal static output buffer; `0` indicates no output |

Allocate the input grid, neighbor array, neighbor grids, and `outSizePtr` in
WASM linear memory. The module reuses its output buffer, so the previous result
becomes invalid on the next encode call. Copy the result before encoding
another tile. Do not free the returned pointer; only free memory allocated by
the caller. Do not call the encoder concurrently on the same WASM instance.

## GeoTIFF to Cesium terrain ZIP

The runnable script [geotiff-to-zip.mjs](../examples/geotiff-to-zip.mjs) samples
GeoTIFF elevations into quantized-mesh tiles, generates `layer.json`, and
packages the result as a ZIP archive. Install the example dependencies and run
it from the repository root:

```bash
cd examples
npm install
cd ..
node examples/geotiff-to-zip.mjs input.tif output.zip 8
```

The arguments are the input GeoTIFF, output ZIP path, and maximum zoom. The
script creates levels from `0` through the selected zoom; the ZIP root contains
`layer.json` and `z/x/y.terrain` files. Extract the directory to deploy it as a
Cesium quantized-mesh terrain resource.

The processing steps are:

1. Read the first raster band and georeferencing with `geotiff`.
2. Sample each covered tile into a 65×65 `float32` grid using nearest-neighbor sampling (row-major from the northwest).
3. Encode quantized-mesh with `dist/ctb_mesh.wasm` and decompress the gzip payload returned by the module.
4. Write the TMS tile paths and `layer.json`, then ZIP the directory with `fflate`.

This end-to-end example has explicit input limits:

- It accepts only single-band, north-up, unrotated, PixelIsArea EPSG:4326 GeoTIFFs. Elevations must already be in meters. Reproject other CRSs or apply rotation/scale/offset handling beforehand.
- It throws if a sampled value is non-finite or matches the GeoTIFF `GDAL_NODATA` value; NoData is not silently replaced.
- If the raster boundary does not align with tile edges, sample points outside the raster use the nearest edge pixel. This extends edge terrain and is not suitable when strict clipping is required.
- The script loads the first band and holds ZIP entries in memory, so it is intended for small or medium datasets. Large datasets need windowed reads and streaming ZIP output.
- `maxZoom` must be an integer from 0 to 30. Practical limits also depend on raster resolution and the number of generated tiles; start with a low zoom.

The module returns gzip-compressed quantized-mesh, while the example decompresses
each `.terrain` payload before adding it to the ZIP. ZIP compression and gzip
serve different purposes; after extracting this archive, the `.terrain` files
do not require HTTP `Content-Encoding: gzip`. If saving the module's gzip bytes
directly instead, the server must set that HTTP header on terrain responses.

## Provenance and reproducibility

The upstream fork URL, branch, pinned commit, and local patch are recorded in
the repository-root `upstream-revision.txt`. The local patch preserves the
upstream file-output behavior; the WASM build does not compile that file.

A successful build confirms that the source and Zig toolchain can produce a
working module; byte-for-byte reproducibility of the WASM binary across build
environments is not guaranteed. To verify encoding compatibility, compare the
decompressed quantized-mesh bytes for identical grids and neighbor inputs.
