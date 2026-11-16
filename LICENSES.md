# 许可证与第三方归属 / Licenses and third-party notices

## 项目许可证 / Project license

本仓库选择 **Apache License 2.0** 作为项目自有代码的许可证，完整条款见根目录
[`LICENSE`](LICENSE)。

This repository selects **Apache License 2.0** for project-authored code. The
full license text is in the root [`LICENSE`](LICENSE) file.

该选择适用于仓库贡献者有权许可的自有代码，不会覆盖或替代下列第三方组件各自的许可。
发布源代码或二进制时，应同时保留本文件、根目录 `LICENSE` 及相应上游许可证。

This applies only to project-authored code that contributors are authorized to
license. It does not override the licenses of the bundled third-party
components. Redistributors should retain this file, the root `LICENSE`, and the
applicable upstream license texts.

## 组件清单 / Component inventory

| 路径 / Path | 组件 / Component | 许可证 / License |
|---|---|---|
| `vendor/ctb-mesh/` | Cesium Terrain Builder fork, pinned in `upstream-revision.txt` | Apache-2.0; see `vendor/ctb-mesh/LICENSE.md` |
| `patches/0001-uncompressed-terrain-output.patch` | 对 CTB 文件输出的本地修改 / Local CTB output patch | CTB 上游许可 / CTB upstream license (Apache-2.0) |
| `wasm/src/ctb_mesh.cpp` | 网格编码入口，基于 CTB 编码代码 / Mesh encoder entry based on CTB encoder code | Apache-2.0 |
| `vendor/zlib-1.3.1/` | zlib 1.3.1 | zlib License; see `vendor/zlib-1.3.1/LICENSE` |
| `dist/ctb_mesh.wasm` | 上述 CTB 与 zlib 编码代码的编译产物 / Compiled CTB and zlib code | 包含 Apache-2.0 与 zlib 许可组件 / Contains Apache-2.0 and zlib-licensed components |

CTB 上游许可证文本及其第三方说明保留在 `vendor/ctb-mesh/LICENSE.md`。
zlib 原始许可证文本保留在 `vendor/zlib-1.3.1/LICENSE`。本仓库不包含 Zig 工具链；
Zig 仅作为构建工具。

The CTB upstream license and its third-party acknowledgments are preserved in
`vendor/ctb-mesh/LICENSE.md`. The original zlib license is preserved in
`vendor/zlib-1.3.1/LICENSE`. The Zig toolchain is not bundled; it is used only
as a build tool.

## 发布提示 / Release note

这是基于仓库内文件及上游许可文本所作的工程许可整理，不构成法律意见。若发布者并非
自有代码的权利人，或新增了其他来源的代码，应在发布前确认授权并更新本清单。

This inventory is an engineering summary based on the bundled files and their
upstream license texts, not legal advice. Before release, confirm the
publisher's rights to project-authored code and update this inventory if
additional sources are introduced.
