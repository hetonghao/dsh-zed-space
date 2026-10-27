# 来源与第三方许可

Zed Space Skin 继续使用下列上游代码、库和字体。安装版把渲染依赖与字体打包在本地；网络安装、更新和访问托管网站不属于离线运行承诺。

## Open Sea Skin 与本项目沿革

- 上游项目：https://github.com/d-dev0101/open-sea-skin
- 本项目旧名 Backspace：https://github.com/hetonghao/dsh-backspace
- 许可：MIT
- 上游版权：© 2026 Open Sea Skin contributors
- 本项目版权：© 2026 Zed Space Skin contributors（包含以 Backspace 名义提交的贡献）

海洋渲染、Harness 集成、扩展与安装器继承自 Open Sea Skin。Backspace 是本项目的旧名；宇宙双视角、本地视频、各皮肤配置与背景切换延续了更名前的功能历史。项目更名后，自有贡献者署名统一为 Zed Space Skin contributors，历史贡献和提交记录保留。`LICENSE` 继续保留 Open Sea Skin 的上游版权声明和完整 MIT 许可。

## three.js 0.178.0

- 项目：https://threejs.org/
- 源码：https://github.com/mrdoob/three.js/tree/r178
- 许可：MIT
- 版权：© 2010–2025 three.js authors
- 本地许可：`shared/vendor/licenses/three-LICENSE.txt`（构建后随 runtime 分发）

内置 WebGPU/TSL 构建已压缩，导入路径调整为本地相对地址；未携带上游可选的远程 WebGPU 调试导入。

## Geist 字体

- 项目：https://vercel.com/font
- 源码：https://github.com/vercel/geist-font
- 许可：SIL Open Font License 1.1
- 本地许可：`shared/vendor/licenses/geist-OFL.txt`（构建后随字体分发）

`.woff2` 文件本地提供。OFL 适用于字体文件，本仓库自有源码仍按 MIT 分发。

## Zed Space 品牌标志

本次使用用户现有同品牌项目的标志：`../zed-space/apps/website/public/brand/zed-space-mark.png`。本仓库的扩展图标与展示标志由该图片复用、缩放而来。此记录说明资产来源，不代表已完成第三方商标或全部历史素材权利清查。

## 历史演示

`site/` 保留原始参考实现，使用 jsDelivr 加载 three.js 0.178.0 与 Geist，保持其历史来源。自包含扩展和 Harness 安装版不使用这些 CDN 地址。
