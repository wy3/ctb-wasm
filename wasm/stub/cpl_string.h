/** 编译期桩：只保留 ctb 用到的三个 CPL 内存函数，映射到标准库。 */
#ifndef WASM_STUB_CPL_CONV_H
#define WASM_STUB_CPL_CONV_H
#include <cstdlib>
#define CPLMalloc(n) std::malloc(n)
#define CPLCalloc(n, s) std::calloc((n), (s))
#define CPLFree(p) std::free(p)
#endif
