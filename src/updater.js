'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { app, dialog, net, shell } = require('electron');

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
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url,
      redirect: 'follow',
      headers: {
        Accept: 'application/octet-stream',
        'User-Agent': 'EZ-Desktop-Shell-Updater'
      }
    });
    request.on('response', (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`下载失败（HTTP ${response.statusCode}）`));
        return;
      }
      const total = Number(response.headers['content-length'] || 0);
      let received = 0;
      const out = fs.createWriteStream(destPath);
      response.on('data', (chunk) => {
        received += chunk.length;
        out.write(chunk);
        if (onProgress && total > 0) onProgress(received / total);
      });
      response.on('end', () => {
        out.end(() => resolve(destPath));
      });
      response.on('error', (err) => {
        out.destroy();
        reject(err);
      });
      out.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
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
    size: hit.size || 0
  };
}

function writeReplaceScript(srcExe, destExe, pid) {
  const scriptPath = path.join(
    app.getPath('temp'),
    `ez-desktop-update-${Date.now()}.cmd`
  );
  const lines = [
    '@echo off',
    'setlocal',
    `set "PID=${pid}"`,
    `set "SRC=${srcExe}"`,
    `set "DST=${destExe}"`,
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

async function applyUpdate(asset, version) {
  const destExe = process.execPath;
  const tmpExe = path.join(
    app.getPath('temp'),
    `EZ-Desktop-Shell-${version}-portable.exe`
  );
  await downloadFile(asset.url, tmpExe);
  const script = writeReplaceScript(tmpExe, destExe, process.pid);
  spawn('cmd.exe', ['/c', script], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  }).unref();
  app.quit();
}

/**
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
    detail: `当前版本 ${current}\n\n下载后将自动替换并重启。\n${notes ? `\n更新说明：\n${notes}` : ''}`,
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

  try {
    await applyUpdate(asset, latest);
    return { status: 'updating', latest };
  } catch (err) {
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