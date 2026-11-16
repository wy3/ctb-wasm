# Build guide

[简体中文版](BUILD.zh-CN.md)

## What is built

The build script compiles the compression/decompression sources from zlib 1.3.1
and the encoding-side CTB `MeshTile` and `GlobalGeodetic` code to WebAssembly.
GDAL I/O, GeoTIFF processing, resampling, and filesystem output are outside the
scope of this repository.

## Requirements

- Zig **0.14.0**, with the `wasm32-wasi` target available.
- Bash (Linux/macOS Bash, Git Bash, or MSYS2 Bash).
- Node.js (only for the bundled smoke test).

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
| `neighborsPtrsPtr` | Array of four `float32*` pointers ordered west, north, east, south; use `0` for a missing neighbor |
| `tileSize` | Must be `65` |
| `z`, `x`, `y` | GlobalGeodetic / TMS tile coordinates; `2^(z+1)` columns and `2^z` rows per level, with `y` increasing northward |
| `outSizePtr` | Pointer to an `int32` where the function writes the compressed byte length |
| Return value | Pointer to an internal static output buffer; `0` indicates no output |

Allocate the input grid, neighbor array, neighbor grids, and `outSizePtr` in
WASM linear memory. The module reuses its output buffer, so the previous result
becomes invalid on the next encode call. Copy the result before encoding
another tile. Do not free the returned pointer; only free memory allocated by
the caller. Do not call the encoder concurrently on the same WASM instance.

The output is **gzip-compressed** quantized-mesh. If the static server does not
send `.terrain` responses with `Content-Encoding: gzip`, decompress the data
before writing the files. Decompression, GeoTIFF sampling, and `layer.json`
generation are the caller's responsibility.

## Provenance and reproducibility

The upstream fork URL, branch, pinned commit, and local patch are recorded in
the repository-root `upstream-revision.txt`. The local patch preserves the
upstream file-output behavior; the WASM build does not compile that file.

A successful build confirms that the source and Zig toolchain can produce a
working module; byte-for-byte reproducibility of the WASM binary across build
environments is not guaranteed. To verify encoding compatibility, compare the
decompressed quantized-mesh bytes for identical grids and neighbor inputs.
