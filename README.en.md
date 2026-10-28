<div align="center">
  <img src="https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/extension/icons/icon128.png" width="80" height="80" alt="Zed Space mark" />
  <h1>Zed Space Skin</h1>
  <p>Dynamic backgrounds and interface skins for DeepSeek Harness</p>
  <p><a href="README.md">简体中文</a> · <strong>English</strong></p>
</div>

Ocean, two cosmic views, and local videos for your Harness workspace. Each scene keeps its own settings, with smooth transitions between backgrounds.

**1.0.1 · Package name: `dsh-zed-space`.** See the [release record](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/publishing/releases/1.0.1.md) for downloads and marketplace review status.

[Source](https://github.com/hetonghao/dsh-zed-space) · [Installation](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/dsh-plugin.md) · [Issues](https://github.com/hetonghao/dsh-zed-space/issues)

This is an independent community plugin for DeepSeek Harness, not an official DeepSeek product or a skin for the DeepSeek web chat site.

## Current features

| Scene or feature | What it does |
| --- | --- |
| Live ocean | Adjust waves and daylight, or enable the automatic day cycle. |
| Two cosmic views | Switch between horizon and vortex, with separate glow, stars, and motion settings. |
| Per-scene settings | Keep scene parameters and glass opacity; optionally adjust the conversation background independently. |
| Local video library | Import multiple files, view thumbnails, enable one video, rename, remove, and restore after reopening. |
| Smooth transitions | Wait for the next frame before blending; both cosmic views transition within one renderer. |

Each video is limited to **32 MiB, 30 seconds, and 1080p**. See [local video background](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/video-background.md) for formats and storage details. Media stays on the device and is not automatically uploaded or synced through a browser account. **The plugin connects to the public [Zed Space wallpaper market](https://zed-space.ai-cove.com/wallpapers).** Open “Discover official animated skins” from “Local video” to browse, preview, and download; applying a downloaded video is a separate action. See [marketplace integration](docs/market-integration.md) for usage and network details.

## Scene gallery

These five screenshots were captured in the real **DeepSeek Harness Web 0.2.1-rc.3** application with `dsh-zed-space@1.0.0` installed in a separate temporary profile. Each image shows the active wallpaper’s settings: glass opacity at its minimum of **40%**, with independent conversation opacity enabled at **60%**. The PNGs are compressed without resizing. See the [capture environment, settings, and media sources](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/screenshots/README.md).

### Black hole · event horizon

![Event horizon running in DeepSeek Harness Web](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/harness-event-horizon.png)

### Black hole · accretion vortex

![Accretion vortex running in DeepSeek Harness Web](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/harness-accretion-vortex.png)

### Ocean · golden hour

![Ocean background running in the light theme of DeepSeek Harness Web](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/harness-ocean.png)

### Local video · sea of clouds

![Sea of clouds video wallpaper playing in DeepSeek Harness Web](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/harness-video-clouds.png)

### Local video · deep dive

![Deep dive video wallpaper playing in DeepSeek Harness Web](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/harness-video-deep-dive.png)

Both videos were imported through the local video library and played in the application. They are demonstration media and are not included with the plugin.

## Installation

In Harness, open Plugins → Add plugin and enter `dsh-zed-space@1.0.1`. For Harness Web:

```sh
dsh plugin --profile web add dsh-zed-space@1.0.1
```

Alternatively, download `dsh-zed-space-1.0.1.tgz` from the [GitHub Release](https://github.com/hetonghao/dsh-zed-space/releases/tag/v1.0.1) and install using its local path. Restart the corresponding Harness instance after installation.

When upgrading from Backspace, remove the old plugin from the same profile before adding the new one. Keep your settings and video data. See [installation and migration](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/install.zh.md).

## Build and preview locally

Requires Node.js 20+. From the repository directory:

```sh
npm ci
npm run build
npm run build:site
npm test
```

`pages-dist/` contains the static website and can be previewed through a local HTTP server. Pages deployment is manual and does not run with npm or GitHub releases.

See [plugin integration](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/dsh-plugin.md), [source integration](https://github.com/hetonghao/dsh-zed-space/blob/main/harness-plugin/README.md), and [migration notes](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/install.zh.md). Do not delete the entire Harness configuration or session directory.

## Common questions

**Can I install this version from npm or a marketplace?**

Use the exact package version or Release file above. Marketplace listing requires maintainer review; see the [release record](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/publishing/releases/1.0.1.md).

**Is there a shared wallpaper marketplace?**

Yes. The public [Zed Space wallpaper market](https://zed-space.ai-cove.com/wallpapers) lets you browse, download to “My videos,” and apply a video in DSH without running a local market server. Saved videos remain available offline. See [marketplace integration](docs/market-integration.md).

**Why is historical Backspace content still present?**

This project evolved from Backspace. Historical changelog entries and media remain for provenance. Git tags in the current repository restart at `v1.0.0`. See [THIRD_PARTY_NOTICES.md](https://github.com/hetonghao/dsh-zed-space/blob/main/THIRD_PARTY_NOTICES.md) and [LICENSE](https://github.com/hetonghao/dsh-zed-space/blob/main/LICENSE) for upstream authorship and licensing.

## Development

[Changelog](https://github.com/hetonghao/dsh-zed-space/blob/main/CHANGELOG.md) · [Contributing](https://github.com/hetonghao/dsh-zed-space/blob/main/CONTRIBUTING.md) · [Privacy](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/privacy.md) · [Security](https://github.com/hetonghao/dsh-zed-space/blob/main/SECURITY.md)
