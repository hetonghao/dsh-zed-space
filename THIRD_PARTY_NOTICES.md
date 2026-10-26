# 来源与第三方许可

Zed Space Skin 继续使用下列上游代码、库和字体。安装版把渲染依赖与字体打包在本地；网络安装、更新和访问托管网站不属于离线运行承诺。

## Open Sea Skin 与 Backspace

- 上游项目：https://github.com/d-dev0101/open-sea-skin
- 历史项目：https://github.com/hetonghao/dsh-backspace
- 许可：MIT
- 版权：© 2026 Open Sea Skin contributors；© 2026 Backspace contributors
- 本项目：© 2026 Zed Space Skin contributors

海洋渲染、Harness 集成、扩展与安装器继承自 Open Sea Skin / Backspace。Zed Space Skin 在此基础上继续维护宇宙双视角、本地视频、各皮肤配置与背景切换；这些功能来自已提交的 Backspace 功能历史，并非改名时重新原创。独立仓库和新名称不消除旧作者贡献，完整 MIT 许可与原版权行保留在 `LICENSE`。

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
