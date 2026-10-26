<div align="center">
  <img src="https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/extension/icons/icon128.png" width="80" height="80" alt="Zed Space mark" />
  <h1>Zed Space Skin</h1>
  <p>Dynamic backgrounds and interface skins for DeepSeek Harness</p>
  <p><a href="README.md">简体中文</a> · <strong>English</strong></p>
</div>

Ocean, two cosmic views, and local videos for your Harness workspace. Each scene keeps its own settings, with smooth transitions between backgrounds.

**Version 1.3.0 is a candidate. The technical package name is `dsh-zed-space`. npm, GitHub Release, the plugin marketplace, and the new Pages site are not published.** The source is available for local build validation; the candidate package name is not an installable release.

[Source](https://github.com/hetonghao/dsh-zed-space) · [Pre-release notes](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/dsh-plugin.md) · [Issues](https://github.com/hetonghao/dsh-zed-space/issues)

This is an independent community plugin for DeepSeek Harness, not an official DeepSeek product or a skin for the DeepSeek web chat site.

## Current features

| Scene or feature | What it does |
| --- | --- |
| Live ocean | Adjust waves and daylight, or enable the automatic day cycle. |
| Two cosmic views | Switch between horizon and vortex, with separate glow, stars, and motion settings. |
| Per-scene settings | Keep scene parameters and glass opacity; optionally adjust the conversation background independently. |
| Local video library | Import multiple files, view thumbnails, enable one video, rename, remove, and restore after reopening. |
| Smooth transitions | Wait for the next frame before blending; both cosmic views transition within one renderer. |

Each video is limited to **32 MiB, 30 seconds, and 1080p**. See [local video background](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/video-background.md) for formats and storage details. Media stays on the device and is not automatically uploaded or synced through a browser account. **A shared wallpaper library is planned; there is no wallpaper marketplace today.**

## Scene gallery

These screenshots run the real plugin code in the project's **isolated test interface**. They show current scenes and settings, **not native Harness captures**. The video example uses a programmatically generated test clip.

### Cosmos · horizon

![Zed Space Skin horizon and settings in an isolated test interface](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-horizon.png)

### Cosmos · vortex

![Zed Space Skin vortex and settings in an isolated test interface](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-vortex.png)

### Ocean · waves and daylight

![Zed Space Skin ocean and settings in an isolated test interface](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-ocean.png)

### Local video · library

![Zed Space Skin local video import and playback in an isolated test interface](https://raw.githubusercontent.com/hetonghao/dsh-zed-space/main/docs/screenshots/zed-video.png)

## Build and preview locally

Requires Node.js 20+. From the repository directory:

```sh
npm ci
npm run build
npm run build:site
npm test
```

`pages-dist/` contains the static website and can be previewed through a local HTTP server. This iteration is for local review. Pages deployment is manual and does not run on push.

See [plugin integration](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/dsh-plugin.md), [source integration](https://github.com/hetonghao/dsh-zed-space/blob/main/harness-plugin/README.md), and [migration notes](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/install.zh.md). Do not delete the entire Harness configuration or session directory.

## Common questions

**Can I install this version from npm or a marketplace?**

Not yet. Version 1.3.0 is unpublished. Installation instructions and downloads will follow publication.

**Is there a shared wallpaper marketplace?**

No. Local video management is implemented; a shared library remains planned.

**Why is historical Backspace content still present?**

This project evolved from Backspace. Historical releases, changelog entries, and media remain for provenance and do not mean Zed Space Skin is published. See [THIRD_PARTY_NOTICES.md](https://github.com/hetonghao/dsh-zed-space/blob/main/THIRD_PARTY_NOTICES.md) and [LICENSE](https://github.com/hetonghao/dsh-zed-space/blob/main/LICENSE) for upstream authorship and licensing.

## Development

[Changelog](https://github.com/hetonghao/dsh-zed-space/blob/main/CHANGELOG.md) · [Contributing](https://github.com/hetonghao/dsh-zed-space/blob/main/CONTRIBUTING.md) · [Privacy](https://github.com/hetonghao/dsh-zed-space/blob/main/docs/privacy.md) · [Security](https://github.com/hetonghao/dsh-zed-space/blob/main/SECURITY.md)
