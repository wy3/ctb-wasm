/**
 * C++ 异常运行时最小实现（wasm32-wasi 的 zig libc++ 不带 libc++abi）。
 *
 * ctb 只把异常用于「输入非法」的前置条件断言，调用方已保证输入合法，
 * 因此这里不需要真正的栈展开：直接 abort 并打印原因。
 */
#include <cstdlib>
#include <cstdio>

extern "C" {

void *__cxa_allocate_exception(unsigned long size) {
  return std::malloc(size);
}

void __cxa_free_exception(void *ptr) {
  std::free(ptr);
}

[[noreturn]] void __cxa_throw(void *thrown, void *typeInfo, void (*dest)(void *)) {
  (void)thrown; (void)typeInfo; (void)dest;
  std::fprintf(stderr, "[ctb] fatal: C++ exception thrown (see CTBException message)\n");
  std::abort();
}

void __cxa_rethrow(void) { std::abort(); }
void *__cxa_begin_catch(void *header) { (void)header; std::abort(); }
void __cxa_end_catch(void) {}

}  // extern "C"
