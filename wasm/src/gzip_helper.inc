/**
 * gzip 压缩（与 ctb 的 gzopen/gzwrite 输出格式一致）。
 * compress2 只产出 zlib 封装（2 字节头），quantized-mesh 要求 gzip（10 字节头）。
 * @param src 原始字节
 * @param out 输出缓冲区（自动 resize）
 * @returns 是否成功
 */
static bool gzipCompress(const std::vector<unsigned char> &src,
                         std::vector<unsigned char> &out) {
  z_stream zs;
  std::memset(&zs, 0, sizeof(zs));
  // windowBits = 15 + 16 → 15 位窗口 + gzip 封装
  if (deflateInit2(&zs, Z_DEFAULT_COMPRESSION, Z_DEFLATED, 15 + 16, 8,
                   Z_DEFAULT_STRATEGY) != Z_OK) {
    return false;
  }
  zs.next_in = const_cast<Bytef *>(src.data());
  zs.avail_in = (uInt)src.size();

  out.resize(deflateBound(&zs, (uLong)src.size()));
  zs.next_out = out.data();
  zs.avail_out = (uInt)out.size();

  const int ret = deflate(&zs, Z_FINISH);
  const size_t produced = out.size() - zs.avail_out;
  deflateEnd(&zs);
  if (ret != Z_STREAM_END) return false;
  out.resize(produced);
  return true;
}

