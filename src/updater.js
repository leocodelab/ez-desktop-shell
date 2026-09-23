'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { app, dialog, net, shell, BrowserWindow } = require('electron');
const { appExecutablePath } = require('./app-path');

const UPDATE_OWNER = 'leocodelab';
const UPDATE_REPO = 'ez-desktop-shell';
const RELEASES_API = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${UPDATE_OWNER}/${UPDATE_REPO}/releases`;

function parseSemver(v) {
  const m = String(v || '')
    .replace(/^v/i, '')
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** @returns {-1|0|1|null} */
function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/** 只接受 GitHub 给出的 sha256: 摘要。没有摘要就不替换 exe。 */
function expectedSha256(digest) {
  const matched = String(digest || '').trim().match(/^sha256:([a-f0-9]{64})$/i);
  return matched ? matched[1].toLowerCase() : null;
}

function hashFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

function safeVersion(version) {
  const cleaned = String(version || '').replace(/[^0-9A-Za-z._-]/g, '');
  return cleaned || 'update';
}

function assertCmdSafe(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('更新路径无效');
  }
  if (/["\r\n]/.test(filePath)) {
    throw new Error('更新路径包含无法安全写入脚本的字符');
  }
}

/** cmd 会展开百分号，写入脚本前先转成 %%。 */
function cmdSetValue(value) {
  return String(value).replace(/%/g, '%%');
}

function unlinkQuiet(filePath) {
  fs.unlink(filePath, (err) => {
    if (!err || err.code === 'ENOENT') return;
    setTimeout(() => {
      fs.unlink(filePath, () => {});
    }, 300);
  });
}

function cancelError() {
  return Object.assign(new Error('已取消更新'), { code: 'CANCELLED' });
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'EZ-Desktop-Shell-Updater',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    let body = '';
    request.on('response', (response) => {
      response.on('data', (chunk) => {
        body += chunk.toString();
      });
      response.on('end', () => {
        if (response.statusCode === 404) {
          reject(Object.assign(new Error('暂无 Release'), { code: 'NO_RELEASE' }));
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(
            new Error(`检查更新失败（HTTP ${response.statusCode}）`)
          );
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

function downloadFile(url, destPath, onProgress) {
  let request = null;
  let aborted = false;
  let settled = false;
  const promise = new Promise((resolve, reject) => {
    const fail = (err, stream) => {
      if (settled) return;
      settled = true;
      const finish = () => unlinkQuiet(destPath);
      if (stream && !stream.destroyed) {
        stream.once('close', finish);
        stream.destroy();
      } else {
        finish();
      }
      reject(err);
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve(destPath);
    };
    request = net.request({
      method: 'GET',
      url,
      redirect: 'follow',
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'EZ-Desktop-Shell-Updater'
      }
    });
    request.on('response', (response) => {
      if (aborted) {
        fail(cancelError(), null);
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.on('data', () => {});
        fail(new Error(`下载失败（HTTP ${response.statusCode}）`), null);
        return;
      }
      const rawLength = response.headers['content-length'];
      const total = Number(Array.isArray(rawLength) ? rawLength[0] : rawLength) || 0;
      let received = 0;
      const out = fs.createWriteStream(destPath);
      response.on('data', (chunk) => {
        if (aborted) return;
        received += chunk.length;
        if (!out.write(chunk)) {
          response.pause();
          out.once('drain', () => {
            if (!aborted) response.resume();
          });
        }
        if (onProgress && total > 0) onProgress(Math.min(1, received / total));
      });
      response.on('end', () => {
        if (aborted) {
          fail(cancelError(), out);
          return;
        }
        out.end(() => succeed());
      });
      response.on('error', (err) => {
        fail(aborted ? cancelError() : err, out);
      });
      out.on('error', (err) => fail(err, out));
    });
    request.on('error', (err) => {
      fail(aborted ? cancelError() : err, null);
    });
    request.end();
  });
  return {
    promise,
    abort() {
      aborted = true;
      try {
        if (request) request.abort();
      } catch {
        /* 请求已经结束 */
      }
    }
  };
}

function pickPortableAsset(release) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const hit =
    assets.find((a) => /portable\.exe$/i.test(a.name || '')) ||
    assets.find((a) => /\.exe$/i.test(a.name || ''));
  if (!hit || !hit.browser_download_url) return null;
  return {
    name: hit.name,
    url: hit.browser_download_url,
    size: hit.size || 0,
    digest: hit.digest || ''
  };
}

/**
 * 当前进程还占着文件时不能覆盖。脚本等到本进程退出，再替换用户双击的那个便携版并重新打开。
 */
function writeReplaceScript(srcExe, destExe, pid) {
  assertCmdSafe(srcExe);
  assertCmdSafe(destExe);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('更新进程号无效');
  const scriptPath = path.join(
    app.getPath('temp'),
    `ez-desktop-update-${Date.now()}.cmd`
  );
  const lines = [
    '@echo off',
    'setlocal',
    `set "PID=${pid}"`,
    `set "SRC=${cmdSetValue(srcExe)}"`,
    `set "DST=${cmdSetValue(destExe)}"`,
    ':wait',
    'tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul',
    'if not errorlevel 1 (',
    '  timeout /t 1 /nobreak >nul',
    '  goto wait',
    ')',
    'timeout /t 1 /nobreak >nul',
    'copy /Y "%SRC%" "%DST%" >nul',
    'if errorlevel 1 (',
    '  echo Update copy failed.',
    '  pause',
    '  exit /b 1',
    ')',
    'del "%SRC%" >nul 2>&1',
    'start "" "%DST%"',
    'del "%~f0" >nul 2>&1'
  ];
  fs.writeFileSync(scriptPath, lines.join('\r\n'), 'utf8');
  return scriptPath;
}

function progressHtml() {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8" />
<style>
  body { margin: 0; font-family: "Segoe UI", sans-serif; background: #0a0a0a; color: #e8e8e8; }
  main { padding: 28px 24px; }
  h1 { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
  p { margin: 0; color: #a3a3a3; font-size: 13px; line-height: 1.5; }
  #pct { margin-top: 16px; font-size: 28px; font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
  <main>
    <h1>正在下载更新</h1>
    <p>核对文件后会自动替换并重启。关闭此窗口可取消。</p>
    <div id="pct">0%</div>
  </main>
</body>
</html>`;
}

function createProgressWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 180,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: '正在下载更新 0%',
    center: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });
  const html = Buffer.from(progressHtml(), 'utf8').toString('base64');
  win.loadURL(`data:text/html;charset=utf-8;base64,${html}`);
  return win;
}

function paintProgressLabel(win, text) {
  if (!win || win.isDestroyed() || win.webContents.isLoading()) return;
  const payload = JSON.stringify(String(text));
  win.webContents.executeJavaScript(
    `(() => { const el = document.getElementById('pct'); if (el) el.textContent = ${payload}; })()`
  ).catch(() => {});
}

function updateProgress(win, ratio) {
  if (!win || win.isDestroyed()) return;
  const pct = Math.max(0, Math.min(100, Math.round(Number(ratio) * 100)));
  win.setTitle(`正在下载更新 ${pct}%`);
  try { win.setProgressBar(pct / 100); } catch { /* 进度条不可用时忽略 */ }
  paintProgressLabel(win, `${pct}%`);
}

function setProgressStatus(win, title, text) {
  if (!win || win.isDestroyed()) return;
  win.setTitle(title);
  // 大于 1 时，Windows 任务栏显示不确定进度。
  try { win.setProgressBar(2); } catch { /* 不确定进度时忽略 */ }
  paintProgressLabel(win, text);
}

async function verifyDownload(filePath, asset, digest) {
  const stat = await fs.promises.stat(filePath);
  if (asset.size && stat.size !== Number(asset.size)) {
    throw Object.assign(
      new Error(`文件大小不符（期望 ${asset.size} 字节，实际 ${stat.size} 字节）`),
      { code: 'BAD_SIZE' }
    );
  }
  const actual = await hashFileSha256(filePath);
  if (actual !== digest) {
    throw Object.assign(
      new Error(`文件校验失败，已取消替换。\n期望 ${digest}\n实际 ${actual}`),
      { code: 'BAD_DIGEST' }
    );
  }
}

/** 先下载并核对摘要，通过后才退出进程、交给脚本替换便携版。 */
async function applyUpdate(asset, version) {
  const digest = expectedSha256(asset && asset.digest);
  if (!digest) {
    throw Object.assign(
      new Error('这个 Release 没有 sha256 digest，已停止替换。请到发布页手动下载。'),
      { code: 'NO_DIGEST' }
    );
  }
  const destExe = appExecutablePath();
  const tmpExe = path.join(
    app.getPath('temp'),
    `EZ-Desktop-Shell-${safeVersion(version)}-portable.exe`
  );
  assertCmdSafe(destExe);
  assertCmdSafe(tmpExe);

  const progress = createProgressWindow();
  let finished = false;
  let userCancelled = false;
  const download = downloadFile(asset.url, tmpExe, (ratio) => updateProgress(progress, ratio));
  const onClose = () => {
    if (finished) return;
    userCancelled = true;
    download.abort();
  };
  progress.on('close', onClose);

  try {
    await download.promise;
    if (userCancelled) throw cancelError();
    updateProgress(progress, 1);
    setProgressStatus(progress, '正在校验更新', '正在校验…');
    await verifyDownload(tmpExe, asset, digest);
    if (userCancelled) throw cancelError();
    setProgressStatus(progress, '正在应用更新', '正在替换…');
    const script = writeReplaceScript(tmpExe, destExe, process.pid);
    finished = true;
    progress.removeListener('close', onClose);
    if (!progress.isDestroyed()) progress.destroy();
    spawn('cmd.exe', ['/c', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
    app.quit();
  } catch (err) {
    finished = true;
    progress.removeListener('close', onClose);
    if (!progress.isDestroyed()) progress.destroy();
    unlinkQuiet(tmpExe);
    throw err;
  }
}

/**
 * 启动时的静默检查只吞掉网络错误。发现新版本仍会询问，不会直接替换。
 * @param {{ silent?: boolean }} [opts]
 */
async function checkForUpdates(opts = {}) {
  const silent = !!opts.silent;
  const current = app.getVersion();

  let release;
  try {
    release = await httpGetJson(RELEASES_API);
  } catch (err) {
    if (silent) return { status: 'error', error: err };
    if (err && err.code === 'NO_RELEASE') {
      await dialog.showMessageBox({
        type: 'info',
        title: '检查更新',
        message: '暂无可用更新',
        detail: `当前版本 ${current}。\n还没有在 GitHub 发布 Release，或仓库尚不可用。\n${RELEASES_PAGE}`
      });
      return { status: 'none' };
    }
    await dialog.showMessageBox({
      type: 'error',
      title: '检查更新',
      message: '检查更新失败',
      detail: String(err && err.message ? err.message : err)
    });
    return { status: 'error', error: err };
  }

  const latest = String(release.tag_name || release.name || '').replace(/^v/i, '');
  const cmp = compareSemver(current, latest);
  if (cmp === null) {
    if (!silent) {
      await dialog.showMessageBox({
        type: 'warning',
        title: '检查更新',
        message: '无法比较版本号',
        detail: `当前 ${current}，远程 ${latest || '(空)'}`
      });
    }
    return { status: 'error' };
  }

  if (cmp >= 0) {
    if (!silent) {
      await dialog.showMessageBox({
        type: 'info',
        title: '检查更新',
        message: '已是最新版本',
        detail: `当前版本 ${current}`
      });
    }
    return { status: 'current', current, latest };
  }

  const asset = pickPortableAsset(release);
  if (!asset) {
    if (!silent) {
      const open = await dialog.showMessageBox({
        type: 'info',
        title: '检查更新',
        message: `发现新版本 ${latest}`,
        detail: 'Release 中没有 portable.exe，请到 GitHub 手动下载。',
        buttons: ['打开发布页', '取消'],
        defaultId: 0,
        cancelId: 1
      });
      if (open.response === 0) shell.openExternal(RELEASES_PAGE);
    }
    return { status: 'available', latest, asset: null };
  }

  const notes = String(release.body || '').trim().slice(0, 800);
  const choice = await dialog.showMessageBox({
    type: 'info',
    title: '发现新版本',
    message: `发现新版本 ${latest}`,
    detail: `当前版本 ${current}\n\n下载并核对后将自动替换并重启。\n${notes ? `\n更新说明：\n${notes}` : ''}`,
    buttons: ['立即更新', '打开发布页', '稍后'],
    defaultId: 0,
    cancelId: 2
  });

  if (choice.response === 1) {
    shell.openExternal(release.html_url || RELEASES_PAGE);
    return { status: 'available', latest, asset };
  }
  if (choice.response !== 0) {
    return { status: 'available', latest, asset };
  }

  if (!app.isPackaged) {
    await dialog.showMessageBox({
      type: 'info',
      title: '检查更新',
      message: '开发运行不会替换程序',
      detail: `发现新版本 ${latest}。请使用打包后的便携版再更新，以免覆盖正在运行的 Electron。`
    });
    return { status: 'available', latest, asset };
  }

  try {
    await applyUpdate(asset, latest);
    return { status: 'updating', latest };
  } catch (err) {
    if (err && err.code === 'CANCELLED') return { status: 'cancelled', latest };
    if (err && err.code === 'NO_DIGEST') {
      const open = await dialog.showMessageBox({
        type: 'warning',
        title: '检查更新',
        message: '无法安全更新',
        detail: String(err.message || err),
        buttons: ['打开发布页', '关闭'],
        defaultId: 0,
        cancelId: 1
      });
      if (open.response === 0) shell.openExternal(release.html_url || RELEASES_PAGE);
      return { status: 'error', error: err };
    }
    await dialog.showMessageBox({
      type: 'error',
      title: '更新失败',
      message: '下载或应用更新失败',
      detail: String(err && err.message ? err.message : err)
    });
    return { status: 'error', error: err };
  }
}

module.exports = {
  checkForUpdates,
  RELEASES_PAGE,
  UPDATE_OWNER,
  UPDATE_REPO
};
