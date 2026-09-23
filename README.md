# EZ Desktop Shell

[English](#english) · [中文](#中文)

Unofficial portable Electron shell for the IQUNIX EZ web keyboard configurator.  
非官方便携版 Electron 外壳，用于打开 IQUNIX EZ 键盘网页配置器。

> **Not affiliated with IQUNIX.** · **与 IQUNIX 无关，非官方、非授权、非附属。**

| | |
| --- | --- |
| Suggested GitHub repo | `leocodelab/ez-desktop-shell` |
| Product name | EZ Desktop Shell |
| Latest local version | 1.1.0 |
| Platform | Windows x64 portable (`.exe`) |
| Upstream site | https://ez.iqunix.com/ |
| License | MIT + project notices below |

---

## 中文

### 这是什么

本项目是一个**极薄的桌面外壳**：用 Electron 打开 [IQUNIX EZ 网页配置器](https://ez.iqunix.com/)，并补上托盘、开机启动、离线提示、WebHID 授权通道、便携包与可选的 GitHub 更新检查。

- **不包含** IQUNIX 官方客户端、安装包、固件、驱动或网页静态资源打包物。
- **不破解、不逆向** 官方协议或固件；不附带任何 IQUNIX 商标素材（本仓库图标为自绘黑白 “EZ”）。
- 键盘配置、设备通信、账号与数据均由 **ez.iqunix.com 及其服务方** 提供与处理；本仓库作者不运营该网站。

### 功能

1. 在线时加载 `https://ez.iqunix.com/`；窗口约 1280×800 起，默认最大化。
2. 系统托盘（关闭进托盘）、开机启动、刷新/清缓存、重新加载、检查更新、退出（简体中文菜单）。
3. `--hidden` 仅托盘启动（配合开机启动）。
4. 为网页侧 WebHID 选设备提供权限桥接。
5. 离线时显示本地 `offline/offline.html` 提示页（非官方站点镜像）。
6. **仅 Windows 便携版**（无安装程序）。

### 快速使用（另一台电脑）

1. 取得 `EZ Desktop Shell-<version>-portable.exe`（自行打包，或日后从 GitHub Releases 下载）。
2. 拷到任意目录，双击运行（可能需绕过 SmartScreen「仍要运行」）。
3. 需能访问 `https://ez.iqunix.com/`。

更新方式（当前）：退出托盘进程后，用新 exe **覆盖**旧文件再打开。若已配置 GitHub Releases，托盘「检查更新」或启动约 8 秒后的静默检查可下载并自动替换。

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
| `src/updater.js` | GitHub Releases 检查更新（便携替换） |
| `assets/` | 自绘黑白 EZ 图标 |
| `offline/` | 离线提示页 |
| `dist/` | 打包输出（不入库） |
| `tools/rcedit-x64.exe` | 打包后写入图标用 |

### 发布到 GitHub（可选）

1. 创建公开仓库（建议名 `ez-desktop-shell`）。
2. 推送源码（勿提交 `dist/`、`node_modules/`）。
3. 发 Release 时上传 `*-portable.exe`，资产名需含 `portable.exe`，供自动更新识别。
4. 修改 `package.json` 的 `version` 后再打包发布。

---

### 法律声明与免责（对使用者与作者均重要）

**重要提示：以下内容不构成律师出具的法律意见。** 作者为中华人民共和国境内自然人/团队维护的开源个人项目，发布本软件仅为学习、交流与个人便利。

#### 1. 非官方与商标

1. 本项目**不是** IQUNIX 及其关联公司的产品，**未获**其授权、赞助、认可或合作。
2. “IQUNIX”“EZ”及官网相关名称、标识、商品外观等，权利归各自权利人所有。本项目名称中的 “EZ” 仅作功能指代，**不主张**任何商标权，也**不暗示**官方来源或质量保证。
3. 禁止任何人利用本项目对外宣称「官方」「正版授权客户端」或进行足以混淆来源的商业宣传。

#### 2. 软件性质与边界

1. 本软件仅为访问公开网页的**浏览器式外壳**，不替代官方软件，不提供键位/固件修改服务本身。
2. 本仓库**不捆绑**从 `ez.iqunix.com` 抓取或缓存的站点资源作为发行物；运行时产生的缓存位于用户本机，由用户自行管理。
3. 远程网站改版、接口变更、地区限制、账号策略或服务中断导致本软件无法使用的，**不视为**本项目缺陷义务，作者无强制修复或永久兼容义务。

#### 3. 用户义务与第三方条款

1. 使用本软件访问第三方网站时，应遵守该网站用户协议、隐私政策及当地法律法规。
2. 因用户违反第三方条款、滥用设备、传播恶意软件、侵犯他人权利等产生的后果，由**用户自行承担**。
3. 请勿将本软件用于任何违法用途。

#### 4. 无担保与责任限制（在中华人民共和国法律允许的最大范围内）

1. 本软件按 **“现状（AS IS）”** 提供，不提供任何明示或默示担保，包括但不限于适销性、特定用途适用性、不侵权、不中断、无错误。
2. 在法律允许的最大范围内，作者及贡献者对因下载、安装、使用、无法使用本软件所产生的任何直接、间接、附带、惩罚性、后果性损害（含数据丢失、设备损坏、利润损失、商誉损失等）**不承担责任**，即使已被告知可能发生该等损害。
3. 若适用法律不允许完全排除责任，作者责任以用户为获得本软件实际支付的对价为上限（开源免费分发情形下通常为 **零元**）。

#### 5. 开源许可与中国法适用

1. 源代码许可见根目录 [LICENSE](./LICENSE)（MIT）。MIT 许可条款与本声明冲突时，**就责任排除、非关联声明、商标与合规边界**，以本 README 声明为准；其余以 MIT 为准。
2. 因本项目、本声明或软件使用引起的争议，适用**中华人民共和国法律**（不含冲突规范）。争议由作者住所地有管辖权的人民法院管辖（作者可同意提交其经常居住地法院）。
3. 本声明某一条款被认定无效的，不影响其他条款效力。

#### 6. 联系与侵权通知

如权利人认为本仓库存在不当表述或应调整说明，请通过 GitHub Issues 联系仓库所有者；作者可在合理范围内修正 README 表述或调整发行说明，**不因此承认侵权或附属关系**。

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

Copy `EZ Desktop Shell-<version>-portable.exe` and run it (SmartScreen may require “Run anyway”). Network access to `https://ez.iqunix.com/` is required.

Updates: replace the exe after quitting the tray app, or use “Check for updates” once GitHub Releases exist.

### Develop / package

```bat
npm install
npm start
npm run dist
```

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
