# ctb-wasm

[English](README.en.md)

将 Cesium Terrain Builder 的高程网格编码部分构建为 WebAssembly，生成 Cesium
quantized-mesh 地形瓦片。本仓库只负责 **65×65 高程网格 → gzip 编码数据**；
GeoTIFF 读取、重采样、文件写入及 `layer.json` 由调用方完成。

## 快速开始

需要 Zig 0.14.0 和 Bash。CTB 源码与 zlib 1.3.1 已包含在仓库中，无需下载依赖。

```bash
./build.sh
node test/smoke.cjs
```

构建结果为 `dist/ctb_mesh.wasm`。Windows 可通过 Git Bash 或 MSYS2 Bash 运行；
如 Zig 不在 `PATH` 中，可设置 `ZIG` 为 Zig 可执行文件的 MSYS 路径。

## WASM 接口

模块导出 `ctb_encode_mesh`、`malloc`、`free` 和 `memory`。编码输入为 65×65
`float32` 高程网格（米，行优先，西北角起始）及四个邻居网格，邻居顺序为左、上、
右、下。坐标使用 GlobalGeodetic / TMS 网格，`y` 从南向北。
实例化模块时还需提供 `wasi_snapshot_preview1` 下的 `fd_close`、`fd_seek`、
`fd_write` 和 `proc_exit` 导入。

返回值指向模块内部缓冲区，内容为 gzip 压缩的 quantized-mesh。调用方必须在下一次
编码调用前复制结果；需将 `.terrain` 以未压缩形式直接提供给静态服务时，应先解压。
完整 ABI、内存生命周期和构建步骤见 [中文构建指南](docs/BUILD.zh-CN.md)。

## 来源与许可证

CTB 上游来源、固定提交和补丁见 [upstream-revision.txt](upstream-revision.txt)。
项目自有代码采用 Apache-2.0；随仓库分发的 CTB 与 zlib 代码分别保留其原有许可。
详细范围和第三方归属见 [LICENSES.md](LICENSES.md)。

仓库简介（用于创建远程仓库）见 [REPOSITORY_DESCRIPTION.md](docs/REPOSITORY_DESCRIPTION.md)。
