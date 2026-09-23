# EZ Desktop Shell

[中文](#中文) · [English](#english)

用 Electron 打开 [IQUNIX EZ 网页配置器](https://ez.iqunix.com/) 的 **Windows 便携外壳**（非官方）。  
Unofficial **Windows portable** Electron shell for the IQUNIX EZ web configurator.

> **与 IQUNIX 无关：非官方、非授权、非附属。** · **Not affiliated with IQUNIX.**

| | |
| --- | --- |
| 下载 / Download | [Releases](https://github.com/leocodelab/ez-desktop-shell/releases) |
| 最新版 / Latest | [Releases](https://github.com/leocodelab/ez-desktop-shell/releases/latest)（当前 v1.1.1） |
| 源码 / Repo | https://github.com/leocodelab/ez-desktop-shell |
| 配置站 / Site | https://ez.iqunix.com/ |
| 许可 / License | MIT + 下方声明 |

---

## 中文

### 一句话说明

这是一个**轻量桌面壳**：双击运行后加载 `ez.iqunix.com`，并附带托盘、开机启动、离线提示、WebHID 选设备通道，以及可选的 GitHub 自动更新。  
它**不是** IQUNIX 官方客户端，也**不包含**官方安装包、固件、驱动或官网网页资源。

### 快速使用

1. 打开 [Releases](https://github.com/leocodelab/ez-desktop-shell/releases)，下载文件名含 `portable.exe` 的便携包  
   （GitHub 可能把空格显示成点，例如 `EZ.Desktop.Shell-*-portable.exe`）。
2. 放到任意目录，双击运行；若出现 SmartScreen，选择「仍要运行」。
3. 需要能访问 `https://ez.iqunix.com/`。

**更新：** 先完全退出托盘进程，再替换 exe；或使用托盘「检查更新」（有 GitHub Release 后，启动约 8 秒也会静默检查）。

### 能做什么 / 不能做什么

**可以：**

- 联网加载官网配置页；窗口默认最大化
- 系统托盘（关闭进托盘）、开机启动、`--hidden` 仅托盘启动
- 刷新 / 清缓存 / 重新加载 / 检查更新 / 退出（简体中文菜单）
- 为网页端 WebHID 选设备提供权限桥接
- 离线时显示本地提示页（不是官网镜像）

**不会 / 不做：**

- 不附带 IQUNIX 商标素材或官方资源（图标为自绘黑白「EZ」）
- 不逆向、不破解官方协议或固件
- 不运营 `ez.iqunix.com`；配置、设备通信、账号均由该站及其运营方处理

### 开发与打包

```bat
cd /d D:\code\ez-desktop-shell
npm install
npm start
npm run dist
```

产物：`dist\EZ Desktop Shell-<version>-portable.exe`（仅便携版，无安装程序）。

可选：对 `dist\win-unpacked\EZ Desktop Shell.exe` 用 `tools\rcedit-x64.exe` 写入 `assets\icon.ico`（不要直接 rcedit 便携 stub）。

### 目录与发版

| 路径 | 说明 |
| --- | --- |
| `src/main.js` | Electron 主进程 |
| `src/updater.js` | GitHub Releases 更新与便携替换 |
| `assets/` | 自绘多尺寸 EZ 图标 |
| `offline/` | 离线提示页 |
| `UPLOAD.md` | 推送 / 发版备忘 |

发新版本：改 `package.json` 的 `version` → `npm run dist` → 推送源码（勿提交 `dist/`、`node_modules/`）→ 建 Release（建议中英双语）并上传 `*-portable.exe`（文件名需含 `portable.exe`），Tag 建议 `vX.Y.Z`。

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

### In short

A **thin desktop shell** that opens [ez.iqunix.com](https://ez.iqunix.com/) in Electron, with tray, login autostart, offline notice, WebHID permission bridging, and optional GitHub update checks.

It is **not** an official IQUNIX app and does **not** ship official installers, firmware, drivers, or bundled website assets.

### Quick start

1. Download the `portable.exe` build from [Releases](https://github.com/leocodelab/ez-desktop-shell/releases) (GitHub may show spaces as dots).
2. Run it from any folder (SmartScreen may require “Run anyway”).
3. Network access to `https://ez.iqunix.com/` is required.

**Updates:** quit the tray app and replace the exe, or use **Check for updates** (a silent check also runs ~8s after launch once Releases exist).

### Scope

**Does:** load the official configurator page; tray / autostart / `--hidden`; WebHID permission plumbing; local offline notice page; Windows portable only.

**Does not:** ship IQUNIX trademarks or official assets (icons are an original B&W “EZ” mark); reverse-engineer protocols or firmware; operate ez.iqunix.com.

### Develop / publish

```bat
npm install
npm start
npm run dist
```

Output: `dist\EZ Desktop Shell-<version>-portable.exe`.

Bump `package.json` `version`, build, push source (no `dist/` / `node_modules/`), create a bilingual Release with a `*-portable.exe` asset, tag `vX.Y.Z`.

### Legal notice

**This is not legal advice.**

1. **Unofficial.** Not affiliated with, endorsed by, or authorized by IQUNIX or its affiliates. Trademarks belong to their owners. Do not market this as an official client.
2. **Shell only.** No bundled official web assets in the repo release; runtime cache stays on the user’s machine.
3. **Third-party terms.** Users must comply with ez.iqunix.com terms and applicable law; misuse is the user’s responsibility.
4. **AS IS.** No warranties. To the maximum extent permitted by applicable law (including the laws of the People’s Republic of China), authors are not liable for damages arising from use or inability to use the software. If liability cannot be fully excluded, it is limited to the amount the user paid for the software (typically zero for free distribution).
5. **Governing law.** Disputes relating to this project are governed by the laws of the PRC; courts at the author’s domicile in the PRC have jurisdiction, unless the author agrees otherwise.
6. MIT license in [LICENSE](./LICENSE); where MIT conflicts with the non-affiliation, trademark, and liability boundaries stated here, those boundaries control.

### License

MIT — see [LICENSE](./LICENSE). Copyright (c) 2026 Leo Code Lab.
