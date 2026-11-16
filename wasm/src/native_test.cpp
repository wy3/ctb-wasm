// 原生验证：与 ctb_mesh.cpp 同一份编码逻辑，输出到文件便于解码校验
#include <cstdio>
#include <vector>
#include <cmath>
extern "C" unsigned char *ctb_encode_mesh(const float *, int, int, int, int, int *);

int main() {
  const int n = 65;
  std::vector<float> h(n * n);
  for (int y = 0; y < n; ++y)
    for (int x = 0; x < n; ++x)
      h[y * n + x] = 100.0f + 50.0f * std::sin(x * 0.2f) * std::cos(y * 0.2f);

  int size = 0;
  unsigned char *buf = ctb_encode_mesh(h.data(), n, 12, 1000, 2000, &size);
  if (!buf) { printf("FAIL\n"); return 1; }
  FILE *fp = fopen("native.terrain", "wb");
  fwrite(buf, 1, size, fp);
  fclose(fp);
  printf("OK gzip_bytes=%d\n", size);
  return 0;
}
