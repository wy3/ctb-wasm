# ctb-wasm

[English](README.en.md)

将 Cesium Terrain Builder 的高程网格编码部分构建为 WebAssembly，生成 Cesium
quantized-mesh 地形瓦片。核心模块负责 **65×65 高程网格 → quantized-mesh 数据**；
另提供一个 EPSG:4326 GeoTIFF 到 Cesium 地形 ZIP 包的端到端示例。

## 快速开始

构建 WASM 需要 Zig 0.14.0 和 Bash。CTB 源码与 zlib 1.3.1 已包含在仓库中，
构建 WASM 本身无需下载依赖。

```bash
./build.sh
node test/smoke.cjs
```

构建结果为 `dist/ctb_mesh.wasm`。Windows 可通过 Git Bash 或 MSYS2 Bash 运行；
如 Zig 不在 `PATH` 中，可设置 `ZIG` 为 Zig 可执行文件的 MSYS 路径。

## Web 示例

```bash
cd examples
npm install
npm run dev:web
```

默认打开中文页面；英文页面位于 `/en.html`。在浏览器中选择 GeoTIFF 并下载地形 ZIP。
输入限制和完整流程见 [中文构建指南](docs/BUILD.zh-CN.md)。

## WASM 接口

模块导出 `ctb_encode_mesh`、`malloc`、`free` 和 `memory`。编码输入为 65×65
`float32` 高程网格（米，行优先，西北角起始）及 WASM 内存中的四项邻居指针数组，
顺序为左、上、右、下，缺失邻居用 `0`。坐标使用 GlobalGeodetic / TMS 网格，`y` 从南向北。
实例化模块时还需提供 `wasi_snapshot_preview1` 下的 `fd_close`、`fd_seek`、
`fd_write` 和 `proc_exit` 导入。

返回值指向模块内部缓冲区，内容为 gzip 压缩的 quantized-mesh。调用方必须在下一次
编码调用前复制结果；需将 `.terrain` 以未压缩形式直接提供给静态服务时，应先解压。
WASM ABI、内存生命周期，以及 [GeoTIFF → terrain 瓦片 → ZIP 的完整示例](examples/geotiff-to-zip.mjs)见 [中文构建指南](docs/BUILD.zh-CN.md)。

## 来源与许可证

CTB 上游来源、固定提交和补丁见 [upstream-revision.txt](upstream-revision.txt)。
项目自有代码采用 Apache-2.0；随仓库分发的 CTB 与 zlib 代码分别保留其原有许可。
详细范围和第三方归属见 [LICENSES.md](LICENSES.md)。

仓库简介（用于创建远程仓库）见 [REPOSITORY_DESCRIPTION.md](docs/REPOSITORY_DESCRIPTION.md)。
