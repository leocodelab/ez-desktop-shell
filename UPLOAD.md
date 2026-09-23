# 上传说明（备忘）

仓库：https://github.com/leocodelab/ez-desktop-shell  
本地：`D:\code\ez-desktop-shell`  
分支：`main`  
远程：`origin`

## 推送源码

```bat
cd /d D:\code\ez-desktop-shell
git push -u origin main
```

## 发版（Releases）

1. 确认 `package.json` 的 `version`
2. `npm run dist` → `dist\EZ Desktop Shell-<version>-portable.exe`
3. 新建 Release，Tag 如 `v1.1.1`；**说明建议中英双语**
4. 上传 `*-portable.exe`（需含 `portable.exe`；GitHub 可能把空格显示成点）

不要提交 `node_modules/`、`dist/`。
