# 构建指南

[English version](BUILD.en.md)

## 构建内容

构建脚本将 zlib 1.3.1 的压缩/解压源码和 CTB 的 `MeshTile`、
`GlobalGeodetic` 编码侧编译成 WASM。WASM 编码器本身不负责 GDAL 读写、GeoTIFF
处理、重采样和文件输出；仓库另有一个范围受限的 Node.js GeoTIFF 到 ZIP 示例。

## 环境要求

- Zig **0.14.0**，需包含 `wasm32-wasi` 编译目标。
- Bash（Linux/macOS Bash、Git Bash 或 MSYS2 Bash）。
- Node.js 和 npm（运行冒烟测试或 GeoTIFF 转换示例）。
- Web 示例使用 Vite 8，要求 Node.js `^20.19.0` 或 `>=22.12.0`。

CTB 上游源码和 zlib 1.3.1 已固定并包含在仓库中，构建时不需要联网。

## 构建

在仓库根目录运行：

```bash
./build.sh
```

如 Zig 未加入 `PATH`，通过 `ZIG` 指定其路径：

```bash
ZIG=/c/tools/zig/zig.exe ./build.sh
```

Windows PowerShell 示例（替换为本机 Zig 路径）：

```powershell
& 'C:\msys64\usr\bin\bash.exe' -lc `
  'cd /f/path/to/ctb-wasm && ZIG=/c/tools/zig/zig.exe ./build.sh'
```

脚本使用临时目录存放目标文件，退出时清理；成功后生成或覆盖
`dist/ctb_mesh.wasm`。仓库已有此文件，因此一般使用者不需要重新构建。

## Web 端示例

在仓库根目录执行以下命令启动本地示例：

```bash
cd examples
npm install
npm run dev:web
```

按 Vite 输出的本地地址打开页面，选择 GeoTIFF 并设置最高 Zoom，页面会在浏览器中
生成并下载 ZIP。文件不会上传；GeoTIFF 解码、WASM 编码和 ZIP 打包都在浏览器内完成。
英文页面在地址末尾加 `/en.html`。
如果要生成静态站点，可在 `examples/` 目录运行 `npm run build:web`，产物位于
`examples/web-dist/`。

页面复用下方的端到端处理流程和同一组输入限制。它会将整个波段及最终 ZIP 保留在内存中，
因此适合小型或中型数据，建议先从低 Zoom 开始。

## 验证

运行冒烟测试，实例化 WASM、编码一个平坦网格，并检查 gzip 解压后的输出：

```bash
node test/smoke.cjs
```

成功时会显示 gzip 输出和解压后 terrain 字节数。该测试验证模块能运行并生成数据，
不等同于对任意 DEM 或每种浏览器运行环境的完整兼容性测试。

## WASM ABI

模块导出：

- `ctb_encode_mesh(heightsPtr, neighborsPtrsPtr, tileSize, z, x, y, outSizePtr)`
- `malloc(size)`、`free(ptr)`、`memory`

实例化时需为 `wasi_snapshot_preview1` 提供 `fd_close`、`fd_seek`、`fd_write`、
`proc_exit` 四个导入。浏览器环境可提供兼容桩函数；也可使用支持该 WASI ABI 的运行时。

参数约定：

| 参数 | 说明 |
|---|---|
| `heightsPtr` | 65×65 `float32` 高程，单位米，行优先，西北角起始 |
| `neighborsPtrsPtr` | 必须分配在 WASM 内存中的四个 `float32*` 指针数组，顺序为左、上、右、下；单侧无邻居用 `0` |
| `tileSize` | 必须为 `65` |
| `z`, `x`, `y` | GlobalGeodetic / TMS 瓦片坐标；每级 `2^(z+1)` 列、`2^z` 行，`y` 从南向北 |
| `outSizePtr` | 指向 `int32` 的指针，函数写入压缩输出字节数 |
| 返回值 | 指向模块内部静态缓冲区的指针；无输出时为 `0` |

`heightsPtr`、邻居数组、邻居网格和 `outSizePtr` 必须在 WASM 线性内存中分配。
结果缓冲区由模块复用，下一次编码调用会使上次返回的内容失效；调用方必须先复制
输出字节，再开始下一次编码。不要对返回指针调用 `free`；只释放调用方自己分配的内存。
同一个 WASM 实例不可并行调用编码函数。

## GeoTIFF 到 Cesium 地形 ZIP

仓库提供可运行脚本 [geotiff-to-zip.mjs](../examples/geotiff-to-zip.mjs)，把 GeoTIFF
高程采样为 quantized-mesh 瓦片，生成 `layer.json`，最后打包为 ZIP。安装示例依赖并从仓库根目录运行：

```bash
cd examples
npm install
cd ..
node examples/geotiff-to-zip.mjs input.tif output.zip 8
```

Windows PowerShell 示例：

```powershell
Push-Location .\examples
npm install
Pop-Location
node .\examples\geotiff-to-zip.mjs .\input.tif .\output.zip 8
```

参数依次为输入 GeoTIFF、输出 ZIP 路径和最高 zoom。示例会生成 `0` 到最高 zoom
的瓦片层级；ZIP 根目录包含 `layer.json` 及 `z/x/y.terrain` 文件。解压后可将该目录
部署为 Cesium quantized-mesh 地形资源。

处理过程如下：

1. 用 `geotiff` 读取第一波段及地理参考信息。
2. 对每个覆盖瓦片，以最近邻方式采样成 65×65 `float32` 网格（行优先、从西北角开始）。
3. 调用 `dist/ctb_mesh.wasm` 编码 quantized-mesh，并解开模块返回的 gzip 数据。
4. 写出 TMS 目录和 `layer.json`，再用 `fflate` 将整个目录打包成 ZIP。

此脚本是端到端示例，输入有明确限制：

- 只接受单波段、北向上、未旋转、PixelIsArea 的 EPSG:4326 GeoTIFF；高程值应已是米。其他投影、旋转栅格、缩放/偏移值需先在外部转换。
- 若采样到非有限值或 GeoTIFF 的 `GDAL_NODATA` 值，脚本会报错，不会静默填值。请先处理 NoData。
- 栅格边界未与瓦片边缘对齐时，瓦片范围外的采样点会使用最近的边缘像素值延伸。该简化会扩展边缘地形，不适合要求严格裁切的数据集。
- 脚本会把第一波段整体读入内存，并将 ZIP 文件条目暂存在内存中；适用于小型或中型数据。大数据集应改为窗口读取和流式打包。
- `maxZoom` 必须为 0–30 的整数；实际可用上限还受数据分辨率和生成瓦片数量影响，建议从较低级别开始试跑。

模块本身输出 gzip 压缩的 quantized-mesh，而示例会先解压 `.terrain` 内容再放入 ZIP。ZIP 的压缩与 gzip 是两层不同用途；解压 ZIP 后的 `.terrain` 不需要 HTTP `Content-Encoding: gzip`。如需直接保存 WASM 返回的 gzip 字节，则服务端必须为 `.terrain` 响应设置该 HTTP 头。

## 来源与可复现性

CTB fork 的仓库地址、分支、固定提交和本地补丁见仓库根目录
`upstream-revision.txt`。本地补丁仅为保留上游文件输出行为；WASM 构建不编译该文件。

构建成功表示源码与 Zig 工具链可产出可运行模块；不同构建环境不承诺 WASM 文件
逐字节一致。需要验证实际编码兼容性时，应对同一组网格和邻居输入比较解压后的
quantized-mesh 字节。
