# EZ Desktop Shell

[中文](#中文) · [English](#english)

Unofficial portable Electron shell for the IQUNIX EZ web keyboard configurator.  
非官方便携版 Electron 外壳，用于打开 IQUNIX EZ 键盘网页配置器。

> **Not affiliated with IQUNIX.** · **与 IQUNIX 无关；非官方、非授权、非附属。**

| | |
| --- | --- |
| GitHub | https://github.com/leocodelab/ez-desktop-shell |
| Releases | https://github.com/leocodelab/ez-desktop-shell/releases |
| Latest release | [v1.1.0](https://github.com/leocodelab/ez-desktop-shell/releases/tag/v1.1.0) |
| Product name | EZ Desktop Shell |
| Version | 1.1.0 |
| Platform | Windows x64 portable (`.exe`) |
| Upstream site | https://ez.iqunix.com/ |
| License | MIT + project notices below |

---

## 中文

### 这是什么

本项目是一个**轻量桌面外壳**：用 Electron 打开 [IQUNIX EZ 网页配置器](https://ez.iqunix.com/)，并提供系统托盘、开机启动、离线提示、WebHID 授权通道、便携打包与可选的 GitHub 更新检查。

- **不包含** IQUNIX 官方客户端、安装包、固件、驱动，也不捆绑网页静态资源到仓库。
- **不逆向、不破解** 官方协议或固件；不含任何 IQUNIX 商标素材；本仓库图标为自绘黑白「EZ」标记。
- 配置功能、设备通信、账号相关均由 **ez.iqunix.com 及其运营方** 提供与处理；本仓库作者不运营该网站。

### 功能

1. 联网时加载 `https://ez.iqunix.com/`；窗口约 1280×800 起，默认最大化。
2. 系统托盘（关闭进托盘）、开机启动、刷新/清缓存、重新加载、「检查更新」、退出（简体中文菜单）。
3. `--hidden` 仅托盘启动，便于开机自启。
4. 为网页端 WebHID 选设备提供权限桥接。
5. 离线时显示本地 `offline/offline.html` 提示页（非官网镜像）。
6. **仅 Windows 便携版**（无安装程序）。

### 如何使用（另一台电脑）

1. 从 [Releases](https://github.com/leocodelab/ez-desktop-shell/releases) 下载便携包（文件名含 `portable.exe`；GitHub 可能把空格显示成点号，例如 `EZ.Desktop.Shell-1.1.0-portable.exe`）。
2. 放到任意目录，双击运行；若触发 SmartScreen，选择「仍要运行」。
3. 需能访问 `https://ez.iqunix.com/`。

更新方式：先完全退出托盘进程，再替换 exe **或** 打开托盘「检查更新」（存在 GitHub Releases 后约 8 秒也会默默检查并自动替换）。

### 开发与打包

```bat
cd /d D:\code\ez-desktop-shell
npm install
npm start
npm run dist
```

产物：`dist\EZ Desktop Shell-<version>-portable.exe`。

若 exe 文件图标未更新，可对 `dist\win-unpacked\EZ Desktop Shell.exe` 使用 `tools\rcedit-x64.exe` 写入 `assets\icon.ico`（不要直接 rcedit 便携 stub）。

### 目录说明

| 路径 | 说明 |
| --- | --- |
| `src/main.js` | Electron 主进程 |
| `src/updater.js` | GitHub Releases 检查更新与便携替换 |
| `assets/` | 自绘黑白 EZ 图标 |
| `offline/` | 离线提示页 |
| `dist/` | 构建产物（不入库） |
| `tools/rcedit-x64.exe` | 可选：写入图标用 |
| `UPLOAD.md` | 本地推送 / 发版备忘 |

### 发布到 GitHub

仓库与首个 Release 已就绪：[`leocodelab/ez-desktop-shell`](https://github.com/leocodelab/ez-desktop-shell)、[`v1.1.0`](https://github.com/leocodelab/ez-desktop-shell/releases/tag/v1.1.0)。

后续版本建议流程：

1. 修改 `package.json` 的 `version` 并重新 `npm run dist`。
2. 推送源码到 `main`（不要提交 `dist/`、`node_modules/`）。
3. 新建 Release（说明建议中英双语），上传 `*-portable.exe`；资源名需含 `portable.exe`，自动更新才能识别。
4. Tag 建议 `vX.Y.Z`，与 `package.json` 版本一致。

---

### 法律与责任声明（对使用者与再分发者均重要）

**重要提示：本声明不构成律师意见或法律咨询。** 本软件为中华人民共和国境内自然人/团队维护的开源壳项目；下载与使用视为学习、自用与风险自担。

#### 1. 非官方与商标

1. 本项目**不是** IQUNIX 或其关联公司的产品，**未经**其授权、背书或关联认证。
2. 「IQUNIX」「EZ」等名称、标识、产品外观等，权利归各自权利人所有。本项目名称中的「EZ」仅作指代，**不主张**任何商标权，也**不暗示**官方来源、合作或认证。
3. 禁止任何人利用本项目进行仿冒、官方宣传，或作为授权客户端、破解工具、盗版资源等商业用途。

#### 2. 外壳边界与技术边界

1. 本软件仅为便于使用网页的**本地外壳容器**，不替代官方软件，不提供刷位/固件修改服务等。
2. 本仓库**不收录**从 `ez.iqunix.com` 抓取或缓存的站点源码作为发布物；运行时产生的缓存在用户本机，由用户自行管理。
3. 远程站点改版、接口变更、地区限制、账号策略变化或中断等导致本壳无法使用的，**不视为**本项目缺陷；作者可选择修改、停用或继续维护。

#### 3. 用户义务与第三方条款

1. 使用本软件访问第三方网站时，应遵守该站用户协议、隐私政策及当地法律法规。
2. 因用户违反前述条款、滥用设备、传播恶意软件、侵犯他人权利等产生的后果，**由用户自行承担**。
3. 不得将本软件用于任何违法用途。

#### 4. 免责声明与责任限制（在中华人民共和国法律允许的最大范围内）

1. 本软件按 **「现状（AS IS）」** 提供，不提供任何明示或默示担保，包括但不限于适销性、特定用途适用性、非侵权、不中断、无瑕疵。
2. 在法律允许的最大范围内，作者及贡献者对因下载、安装、使用、无法使用本软件而导致的任何直接、间接、附带、特殊、惩罚性损害（包括数据丢失、设备损坏、利润损失、商誉损失等）**不承担责任**，即使已被告知可能发生该等损害。
3. 若适用法律不允许完全排除责任，则责任以用户为获得本软件实际支付的对价为上限（开源免费分发情形通常为 **零元**）。

#### 5. 开源许可与中国法适用

1. 源代码许可见根目录 [LICENSE](./LICENSE)（MIT）。MIT 许可条款与本声明冲突时，**非官方声明、商标与免责边界**以本 README 声明为准；其余以 MIT 为准。
2. 因本项目下载、分发、使用等引起的争议，适用**中华人民共和国法律**；因规范冲突导致管辖约定无效的除外。由作者住所地有管辖权的人民法院管辖；作者可同意提交至经双方协商的其他法院。
3. 若本声明某一条款被认定无效，不影响其余条款的效力。

#### 6. 联系与版权通知

版权声明见仓库内文件。若认为本仓库内容应调整说明，请通过 GitHub Issues 联系仓库维护者；维护者可在合理范围内更新 README 或相关说明。**请勿直接向商标权利人冒充联系。**

---

## English

### What this is

A **thin desktop shell** that opens the [IQUNIX EZ web configurator](https://ez.iqunix.com/) in Electron, with tray, login autostart, offline notice page, WebHID permission bridging, portable packaging, and optional GitHub release update checks.

- Does **not** ship IQUNIX official apps, installers, firmware, drivers, or bundled copies of their website assets.
- Does **not** reverse-engineer proprietary protocols or firmware; icons are an original B&W “EZ” mark for this shell only.
- Configuration features and device traffic are provided by **ez.iqunix.com and its operators**; this project does not operate that site.

### Features

1. Loads `https://ez.iqunix.com/` when online; ~1280×800 minimum; maximized by default.
2. Tray (close-to-tray), open at login, refresh/clear cache, reload, check for updates, quit (Simplified Chinese menu).
3. `--hidden` tray-only launch for autostart.
4. WebHID permission plumbing for the embedded site.
5. Offline fallback page under `offline/` (not a mirror of the official site).
6. **Windows portable only** (no installer).

### Use on another PC

1. Download the portable build from [Releases](https://github.com/leocodelab/ez-desktop-shell/releases) (filename contains `portable.exe`; GitHub may show spaces as dots, e.g. `EZ.Desktop.Shell-1.1.0-portable.exe`).
2. Run it from any folder (SmartScreen may require “Run anyway”).
3. Network access to `https://ez.iqunix.com/` is required.

Updates: quit the tray app and replace the exe, or use **Check for updates** once GitHub Releases exist (a silent check also runs ~8s after launch).

### Develop / package

```bat
npm install
npm start
npm run dist
```

Output: `dist\EZ Desktop Shell-<version>-portable.exe`.

### Publishing

Repo and first release are live: [`leocodelab/ez-desktop-shell`](https://github.com/leocodelab/ez-desktop-shell), [`v1.1.0`](https://github.com/leocodelab/ez-desktop-shell/releases/tag/v1.1.0).

For later versions: bump `package.json` `version`, `npm run dist`, push source (no `dist/` / `node_modules/`), create a **bilingual** Release with a `*-portable.exe` asset (name must contain `portable.exe`), tag `vX.Y.Z`.

### Legal notice (summary)

**This is not legal advice.**

1. **Unofficial.** Not affiliated with, endorsed by, or authorized by IQUNIX or its affiliates. Trademarks belong to their owners. Do not market this as an official client.
2. **Shell only.** No bundled official web assets in the repo release; runtime cache stays on the user’s machine.
3. **Third-party terms.** Users must comply with ez.iqunix.com terms and applicable law; misuse is the user’s responsibility.
4. **AS IS.** No warranties. To the maximum extent permitted by applicable law (including the laws of the People’s Republic of China), authors are not liable for damages arising from use or inability to use the software. If liability cannot be fully excluded, it is limited to the amount the user paid for the software (typically zero for free distribution).
5. **Governing law.** Disputes relating to this project are governed by the laws of the PRC; courts at the author’s domicile in the PRC have jurisdiction, unless the author agrees otherwise.
6. MIT license in [LICENSE](./LICENSE); where MIT conflicts with the non-affiliation, trademark, and liability boundaries stated here, those boundaries control.

### License

MIT — see [LICENSE](./LICENSE). Copyright (c) 2026 Leo Code Lab.
