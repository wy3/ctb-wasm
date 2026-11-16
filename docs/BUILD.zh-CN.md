# 构建指南

[English version](BUILD.en.md)

## 构建内容

构建脚本将 zlib 1.3.1 的压缩/解压源码和 CTB 的 `MeshTile`、
`GlobalGeodetic` 编码侧编译成 WASM。GDAL 读写、GeoTIFF 处理、重采样和磁盘输出
不在本仓库的职责范围内。

## 环境要求

- Zig **0.14.0**，需包含 `wasm32-wasi` 编译目标。
- Bash（Linux/macOS Bash、Git Bash 或 MSYS2 Bash）。
- Node.js（仅运行随仓库提供的冒烟测试）。

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
| `neighborsPtrsPtr` | 四个 `float32*` 指针组成的数组，顺序为左、上、右、下；无邻居用 `0` |
| `tileSize` | 必须为 `65` |
| `z`, `x`, `y` | GlobalGeodetic / TMS 瓦片坐标；每级 `2^(z+1)` 列、`2^z` 行，`y` 从南向北 |
| `outSizePtr` | 指向 `int32` 的指针，函数写入压缩输出字节数 |
| 返回值 | 指向模块内部静态缓冲区的指针；无输出时为 `0` |

`heightsPtr`、邻居数组、邻居网格和 `outSizePtr` 必须在 WASM 线性内存中分配。
结果缓冲区由模块复用，下一次编码调用会使上次返回的内容失效；调用方必须先复制
输出字节，再开始下一次编码。不要对返回指针调用 `free`；只释放调用方自己分配的内存。
同一个 WASM 实例不可并行调用编码函数。

输出为 **gzip 压缩**的 quantized-mesh 字节。若静态服务器不会为 `.terrain` 响应设置
`Content-Encoding: gzip`，调用方应在写入文件前解压。解压、GeoTIFF 采样和
`layer.json` 均由调用方负责。

## 来源与可复现性

CTB fork 的仓库地址、分支、固定提交和本地补丁见仓库根目录
`upstream-revision.txt`。本地补丁仅为保留上游文件输出行为；WASM 构建不编译该文件。

构建成功表示源码与 Zig 工具链可产出可运行模块；不同构建环境不承诺 WASM 文件
逐字节一致。需要验证实际编码兼容性时，应对同一组网格和邻居输入比较解压后的
quantized-mesh 字节。
