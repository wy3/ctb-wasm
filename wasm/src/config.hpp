#ifndef WASM_CONFIG_HPP
#define WASM_CONFIG_HPP
#define CTB_DLL
#include <string>
#include <sstream>
namespace ctb {
  const struct semver { const unsigned short int major, minor, patch; const char *cstr; }
    version = { 0, 4, 1, "0.4.1" };
  /// 网格边长（65 = 64 段 + 1，quantized-mesh 规范固定值）
  const unsigned short int TILE_SIZE = 65;
  const unsigned short int MASK_SIZE = 256;
}
#endif
