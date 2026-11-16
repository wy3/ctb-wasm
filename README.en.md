# ctb-wasm

[简体中文](README.md)

Builds the height-grid encoder from Cesium Terrain Builder as WebAssembly and
produces Cesium quantized-mesh terrain tiles. This repository handles only
**65×65 height grids → gzip-compressed mesh bytes**. Reading GeoTIFFs,
resampling, file output, and `layer.json` generation belong to the caller.

## Quick start

Requires Zig 0.14.0 and Bash. The CTB source and zlib 1.3.1 are included; no
dependency download is required.

```bash
./build.sh
node test/smoke.cjs
```

The build output is `dist/ctb_mesh.wasm`. On Windows, run the commands from
Git Bash or MSYS2 Bash. If Zig is not on `PATH`, set `ZIG` to its executable
using an MSYS-style path.

## WASM interface

The module exports `ctb_encode_mesh`, `malloc`, `free`, and `memory`. Encoding
accepts a 65×65 `float32` elevation grid in meters (row-major, starting at the
northwest) and four optional neighbor grids ordered west, north, east, south.
Coordinates use the GlobalGeodetic / TMS scheme, with `y` increasing northward.
Instantiation also requires `fd_close`, `fd_seek`, `fd_write`, and `proc_exit`
imports under `wasi_snapshot_preview1`.

The returned pointer references an internal buffer containing gzip-compressed
quantized-mesh data. Copy the bytes before the next encode call. If serving
`.terrain` files directly from a static server without gzip content encoding,
decompress the payload first. See the [English build guide](docs/BUILD.en.md)
for the full ABI, memory-lifetime rules, and build details.

## Provenance and licensing

The upstream CTB source, pinned commit, and local patch are recorded in
[upstream-revision.txt](upstream-revision.txt). Apache-2.0 is selected for
project-authored code; the bundled CTB and zlib components retain their
respective upstream licenses. See [LICENSES.md](LICENSES.md) for scope and
third-party notices.

Suggested hosting-site metadata is in
[REPOSITORY_DESCRIPTION.md](docs/REPOSITORY_DESCRIPTION.md).
