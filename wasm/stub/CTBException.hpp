/**
 * 编译期桩：WASM 目标无 C++ 异常运行时（zig 的 wasm32-wasi 不带 libc++abi）。
 *
 * ctb 只在「输入数据非法」时 throw，而这些前置条件由调用方（JS）保证：
 * 高程网格尺寸固定 65x65、瓦片坐标合法。因此把 throw 换成 abort()，
 * 一旦真的走到这里会立刻 trap，而不是静默继续。
 */
#ifndef WASM_STUB_CTBEXCEPTION_HPP
#define WASM_STUB_CTBEXCEPTION_HPP

#include <cstdlib>
#include <cstdio>

namespace ctb {
  class CTBException {
  public:
    explicit CTBException(const char *message) {
      std::fprintf(stderr, "[ctb] %s\n", message);
      std::abort();
    }
  };
}

#endif
