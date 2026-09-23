# 上传说明（本地已就绪）

仓库：https://github.com/leocodelab/ez-desktop-shell  
本地路径：`D:\code\ez-desktop-shell`  
分支：`main`（已有初始提交，工作区干净）  
远程：`origin` → 上述 URL

## 1. 推送源码（必做）

在可访问 GitHub 的网络下（VPN / 代理均可）：

```bat
cd /d D:\code\ez-desktop-shell
git push -u origin main
```

浏览器登录 GitHub 后也可用 GitHub Desktop，打开本目录再 Push。

## 2. 发布便携版（可选，给自动更新用）

1. 确认 `package.json` 里 `version`（当前 1.1.0）
2. 本地已有：`dist\EZ Desktop Shell-1.1.0-portable.exe`（或再跑 `npm run dist`）
3. 在 GitHub 创建 Release，Tag 建议 `v1.1.0`
4. 上传资源：`EZ Desktop Shell-1.1.0-portable.exe`（文件名需含 `portable.exe`，托盘「检查更新」才能识别）

不要提交 `node_modules/`、`dist/`（已在 `.gitignore`）。

## 已包含在首次提交中的文件

.gitignore、LICENSE、README.md、package.json、src/、offline/、assets/、tools/rcedit-x64.exe
