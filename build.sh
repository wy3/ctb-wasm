#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")" && pwd)
ZIG=${ZIG:-zig}
CTB_SRC="$ROOT/vendor/ctb-mesh/src"
ZLIB="$ROOT/vendor/zlib-1.3.1"
WASM_SRC="$ROOT/wasm/src"
STUB="$ROOT/wasm/stub"
DIST="$ROOT/dist"

if ! command -v "$ZIG" >/dev/null 2>&1; then
  echo "找不到 Zig：$ZIG（请安装 Zig 0.14.0 或设置 ZIG）" >&2
  exit 1
fi
if [[ ! -d "$ZLIB" ]]; then
  echo "找不到 zlib 源码：$ZLIB" >&2
  exit 1
fi
if [[ ! -f "$CTB_SRC/MeshTile.cpp" ]]; then
  echo "找不到 CTB 源码：$CTB_SRC" >&2
  exit 1
fi

TMP=$(mktemp -d "$ROOT/.build-XXXXXX")
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DIST"

CFLAGS=(-target wasm32-wasi -O2 -std=c11 "-I$ZLIB")
for file in adler32 crc32 deflate trees zutil inflate inftrees inffast infback compress uncompr; do
  "$ZIG" cc "${CFLAGS[@]}" -c "$ZLIB/$file.c" -o "$TMP/z_$file.o"
done

CXXFLAGS=(-target wasm32-wasi -O2 -std=c++11 -fno-rtti
  "-I$WASM_SRC" "-I$STUB" "-I$CTB_SRC" "-I$ZLIB")
for file in ctb_mesh cxa_stub stub_main; do
  "$ZIG" c++ "${CXXFLAGS[@]}" -c "$WASM_SRC/$file.cpp" -o "$TMP/$file.o"
done
for file in MeshTile GlobalGeodetic; do
  "$ZIG" c++ "${CXXFLAGS[@]}" -c "$CTB_SRC/$file.cpp" -o "$TMP/$file.o"
done

objects=("$TMP"/*.o)
"$ZIG" c++ -target wasm32-wasi -O2 -fno-rtti \
  -o "$DIST/ctb_mesh.wasm" "${objects[@]}" \
  -Wl,--export=ctb_encode_mesh -Wl,--export=malloc -Wl,--export=free \
  -Wl,--initial-memory=33554432

ls -lh "$DIST/ctb_mesh.wasm"
