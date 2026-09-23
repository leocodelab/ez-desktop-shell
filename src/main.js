'use strict';

const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  session,
  shell,
  dialog,
  net,
  screen,
  ipcMain
} = require('electron');
const { checkForUpdates } = require('./updater');
const { appExecutablePath } = require('./app-path');

const APP_URL = 'https://ez.iqunix.com/';
const TRUSTED_HOST = 'ez.iqunix.com';
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'window-bounds.json');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'shell-settings.json');
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 800;
const TITLE_BAR_HEIGHT = 44;
/** 把页面内容下移，避免被自定义标题栏挡住。 */
const TOP_CONTENT_INSET = TITLE_BAR_HEIGHT;
const BOUNDS_SAVE_DELAY_MS = 400;
const HID_WAIT_MS = 30000;
/** 键盘插入时会连续上报多个 HID 接口，稍等再决定选哪一个。 */
const HID_SETTLE_MS = 700;
/** 窗口几乎移出屏幕时，拉回工作区。单位是像素。 */
const WINDOW_EDGE_MARGIN = 80;
/**
 * 这些加载错误改显示离线页：-106 断网，-105 域名解析失败，-2 连接失败。
 * -3 是导航被取消，不能当成断网。
 */
const OFFLINE_ERROR_CODES = new Set([-106, -105, -2]);

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;
/** 仅在带 --hidden 启动时，第一个窗口保持隐藏。 */
let initialHiddenLaunch = process.argv.includes('--hidden');
/** @type {ReturnType<typeof setTimeout> | null} */
let saveBoundsTimer = null;
/** 已经接过 WebHID 监听的会话，避免重复注册。 */
const hidSessions = new WeakSet();
const guardedContents = new WeakSet();
const insetKeys = new WeakMap();
/** @type {{ token: object, reply: (id: string) => void, timer: ReturnType<typeof setTimeout> | null, settleTimer: ReturnType<typeof setTimeout> | null, window: BrowserWindow | null, found: any[] } | null} */
let activeHid = null;
let shellSettings = null;

function isLiveWindow(win) {
  return !!(win && !win.isDestroyed());
}

/** 远程页面不开放 Node。每次返回新对象，避免窗口之间共用同一份配置。 */
function lockedWebPreferences(extra) {
  return Object.assign({
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true
  }, extra);
}

function promptPreloadPath() {
  const unpacked = path.join(__dirname, 'prompt-preload.js').replace(
    `${path.sep}app.asar${path.sep}`,
    `${path.sep}app.asar.unpacked${path.sep}`
  );
  return fs.existsSync(unpacked) ? unpacked : path.join(__dirname, 'prompt-preload.js');
}

function loadSettings() {
  if (shellSettings) return shellSettings;
  try {
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8'));
    shellSettings = { topInset: data.topInset !== false };
  } catch {
    shellSettings = { topInset: true };
  }
  return shellSettings;
}

function saveSettings(partial) {
  const next = { ...loadSettings(), ...partial };
  shellSettings = next;
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to save shell settings:', err);
  }
  return next;
}

function loadBounds() {
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(BOUNDS_FILE(), 'utf8'));
  } catch {
    data = null;
  }
  const width = Math.max(MIN_WIDTH, Number(data && data.width) || MIN_WIDTH);
  const height = Math.max(MIN_HEIGHT, Number(data && data.height) || MIN_HEIGHT);
  const bounds = {
    width,
    height,
    isMaximized: !data || data.isMaximized !== false
  };
  if (
    data &&
    typeof data.x === 'number' &&
    typeof data.y === 'number' &&
    Number.isFinite(data.x) &&
    Number.isFinite(data.y)
  ) {
    bounds.x = data.x;
    bounds.y = data.y;
  }
  return placeOnScreen(bounds);
}

function placeOnScreen(bounds) {
  if (typeof bounds.x !== 'number' || typeof bounds.y !== 'number') return bounds;
  try {
    const display = screen.getDisplayMatching({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    const area = display.workArea;
    let x = bounds.x;
    let y = bounds.y;
    if (x < area.x || x > area.x + area.width - WINDOW_EDGE_MARGIN) x = area.x;
    if (y < area.y || y > area.y + area.height - WINDOW_EDGE_MARGIN) y = area.y;
    return { ...bounds, x, y };
  } catch {
    return bounds;
  }
}

function saveBounds() {
  if (!isLiveWindow(mainWindow)) return;
  try {
    if (mainWindow.isMinimized() || !mainWindow.isVisible()) return;
    const isMaximized = mainWindow.isMaximized();
    const bounds = isMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();
    const payload = {
      x: bounds.x,
      y: bounds.y,
      width: Math.max(bounds.width, MIN_WIDTH),
      height: Math.max(bounds.height, MIN_HEIGHT),
      isMaximized
    };
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(BOUNDS_FILE(), JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to save window bounds:', err);
  }
}

function scheduleSaveBounds() {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    saveBoundsTimer = null;
    saveBounds();
  }, BOUNDS_SAVE_DELAY_MS);
}

function flushSaveBounds() {
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = null;
  }
  saveBounds();
}

function assetCandidates(fileName) {
  return [
    path.join(__dirname, '..', 'assets', fileName),
    path.join(process.resourcesPath || '', 'assets', fileName)
  ];
}

function firstExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function iconPath() {
  return firstExisting([
    ...assetCandidates('icon.ico'),
    ...assetCandidates('icon.png')
  ]);
}

/** Prefer a crisp PNG sized for the current display scale (tray/taskbar). */
function trayIconPath() {
  let scale = 1;
  try {
    scale = screen.getPrimaryDisplay().scaleFactor || 1;
  } catch {
    scale = 1;
  }
  const target = Math.round(16 * scale);
  const sizes = [16, 20, 24, 32, 40, 48, 64];
  let best = sizes[0];
  let bestDist = Math.abs(best - target);
  for (const s of sizes) {
    const d = Math.abs(s - target);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  const sized = firstExisting(assetCandidates(`icon-${best}.png`));
  if (sized) return sized;
  return firstExisting([
    ...assetCandidates('icon-32.png'),
    ...assetCandidates('icon-40.png'),
    ...assetCandidates('icon-16.png'),
    ...assetCandidates('icon.png'),
    ...assetCandidates('icon.ico')
  ]);
}

function readIconPng(size) {
  const p = firstExisting(assetCandidates(`icon-${size}.png`));
  if (!p) return null;
  try {
    return fs.readFileSync(p);
  } catch {
    return null;
  }
}

function createNativeIcon() {
  // Prefer a sharp PNG for the window; ICO is mainly for the packaged exe.
  const preferred = firstExisting([
    ...assetCandidates('icon-256.png'),
    ...assetCandidates('icon-128.png'),
    ...assetCandidates('icon.png'),
    ...assetCandidates('icon.ico')
  ]);
  const p = preferred || iconPath();
  if (!p) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(p);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
}

function createTrayIcon() {
  const multi = nativeImage.createEmpty();
  for (const size of [16, 20, 24, 32, 40, 48]) {
    const buffer = readIconPng(size);
    if (!buffer) continue;
    multi.addRepresentation({
      scaleFactor: size / 16,
      width: size,
      height: size,
      buffer
    });
  }
  if (!multi.isEmpty()) return multi;

  const p = trayIconPath();
  if (!p) return nativeImage.createEmpty();
  let img = nativeImage.createFromPath(p);
  if (img.isEmpty()) return nativeImage.createEmpty();
  // Keep bitmap at its designed pixel size; avoid Electron resizing a large ICO down.
  const { width, height } = img.getSize();
  if (width > 64 || height > 64) {
    img = img.resize({ width: 32, height: 32, quality: 'best' });
  }
  return img;
}

function offlinePageUrl() {
  return path.join(__dirname, '..', 'offline', 'offline.html');
}

function isOnline() {
  try {
    return net.isOnline();
  } catch {
    return true;
  }
}

/** 只有配置器站点可以停留在壳内，并获得 HID / USB / 剪贴板权限。 */
function isTrustedConfiguratorUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (parsed.hostname.toLowerCase() !== TRUSTED_HOST) return false;
    if (parsed.port && parsed.port !== '443') return false;
    return true;
  } catch {
    return false;
  }
}

function isOfflinePage(url) {
  try {
    if (!String(url).startsWith('file:')) return false;
    const got = path.normalize(fileURLToPath(url));
    const expected = path.normalize(offlinePageUrl());
    return got.toLowerCase() === expected.toLowerCase();
  } catch {
    return false;
  }
}

/** 主文档只允许配置器、本地离线页、等待键盘页，以及窗口创建时的 about:blank。 */
function isAllowedNavigation(url) {
  if (!url || url === 'about:blank') return true;
  if (url.startsWith('data:text/html')) return true;
  if (isOfflinePage(url)) return true;
  return isTrustedConfiguratorUrl(url);
}

function isOpenableExternal(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** 离开允许名单的 http(s) 链接交给系统浏览器，不在这个带设备权限的窗口里打开。 */
function attachNavigationGuard(contents) {
  if (!contents || guardedContents.has(contents)) return;
  guardedContents.add(contents);

  const blockTopLevel = (event, url) => {
    if (isAllowedNavigation(url)) return;
    event.preventDefault();
    if (isOpenableExternal(url)) shell.openExternal(url);
  };

  contents.on('will-navigate', (event, url) => {
    if (url === 'about:blank') {
      const current = contents.getURL();
      if (!current || current === 'about:blank') return;
      event.preventDefault();
      return;
    }
    blockTopLevel(event, url);
  });

  contents.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    const nextUrl = (event && event.url) || url;
    const mainFrame = typeof isMainFrame === 'boolean'
      ? isMainFrame
      : !!(event && event.isMainFrame);
    if (!mainFrame) return;
    blockTopLevel(event, nextUrl);
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (isTrustedConfiguratorUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          backgroundColor: '#0a0a0a',
          webPreferences: lockedWebPreferences()
        }
      };
    }
    if (isOpenableExternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

/** 只认 IQUNIX / EZ 系列键盘，避免把列表里的第一台无关设备连上。 */
function looksLikeIqunix(device) {
  const hay = [
    device.productName,
    device.manufacturerName,
    device.name,
    device.serialNumber
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes('iqunix')
    || hay.includes('ez series')
    || hay.includes('iqx')
    || /\bez(?:60|63|80)\b/.test(hay);
}

function deviceLabel(device, index) {
  const name = String(device.productName || device.name || 'HID 设备').replace(/&/g, ' ');
  const vid = Number.isInteger(device.vendorId) ? device.vendorId.toString(16).padStart(4, '0') : '';
  const pid = Number.isInteger(device.productId) ? device.productId.toString(16).padStart(4, '0') : '';
  const id = vid && pid ? ` ${vid}:${pid}` : '';
  const text = `${index + 1}. ${name}${id}`;
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

/** 设备选择回调只能成功一次。不传 deviceId 表示取消这次请求。 */
function onceCallback(callback) {
  let done = false;
  return (deviceId) => {
    if (done) return;
    done = true;
    try {
      if (deviceId) callback(deviceId);
      else callback();
    } catch (err) {
      console.warn('HID select callback error:', err);
    }
  };
}

function frameUrlFrom(frame) {
  try {
    return frame && typeof frame.url === 'string' ? frame.url : '';
  } catch {
    return '';
  }
}

function hidDeviceFrom(details) {
  if (details && details.device && details.device.deviceId) return details.device;
  if (details && details.deviceId) return details;
  return null;
}

function dialogParent() {
  if (!isLiveWindow(mainWindow)) return undefined;
  if (!mainWindow.isVisible() || mainWindow.isMinimized()) return undefined;
  return mainWindow;
}

function settleHid(deviceId) {
  const current = activeHid;
  if (!current) return;
  activeHid = null;
  if (current.timer) clearTimeout(current.timer);
  if (current.settleTimer) clearTimeout(current.settleTimer);
  const win = current.window;
  current.window = null;
  // 先去掉 closed 监听，否则 destroy 会把同一次选择再取消一遍。
  if (win && !win.isDestroyed()) {
    win.removeAllListeners('closed');
    win.destroy();
  }
  current.reply(deviceId);
}

async function promptHidChoice(devices) {
  const labels = devices.map((device, index) => deviceLabel(device, index));
  const cancelIndex = labels.length;
  const parent = dialogParent();
  const options = {
    type: 'question',
    title: '选择键盘',
    message: '检测到多台 IQUNIX 设备',
    detail: '请选择要连接的设备。名称相同的多项通常是同一把键盘的不同接口，选错可以刷新页面后重试。',
    buttons: labels.concat('取消'),
    cancelId: cancelIndex,
    defaultId: 0,
    noLink: true
  };
  const { response } = parent
    ? await dialog.showMessageBox(parent, options)
    : await dialog.showMessageBox(options);
  if (response < 0 || response >= devices.length) return null;
  return devices[response];
}

function startHidSelection(reply) {
  const token = {};
  activeHid = {
    token,
    reply,
    timer: null,
    settleTimer: null,
    window: null,
    found: []
  };
  return token;
}

function trackHidChoice(token, devices) {
  promptHidChoice(devices).then((device) => {
    if (!activeHid || activeHid.token !== token) return;
    settleHid(device ? device.deviceId : '');
  }).catch(() => {
    if (!activeHid || activeHid.token !== token) return;
    settleHid('');
  });
}

function openHidWait(token) {
  const parent = dialogParent();
  const windowOptions = {
    width: 440,
    height: 230,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: '等待键盘',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: lockedWebPreferences({ preload: promptPreloadPath() })
  };
  if (parent) {
    windowOptions.parent = parent;
    windowOptions.modal = true;
  }
  const win = new BrowserWindow(windowOptions);
  if (!activeHid || activeHid.token !== token) {
    win.destroy();
    return;
  }
  activeHid.window = win;
  win.on('closed', () => {
    if (!activeHid || activeHid.token !== token) return;
    activeHid.window = null;
    settleHid('');
  });
  activeHid.timer = setTimeout(() => {
    if (!activeHid || activeHid.token !== token) return;
    settleHid('');
  }, HID_WAIT_MS);
  win.once('ready-to-show', () => {
    if (!win.isDestroyed()) win.show();
  });
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(hidWaitHtml())}`);
}

function hidWaitHtml() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';" />
  <title>等待键盘</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #0a0a0a;
      color: #e8e8e8;
      overflow: hidden;
    }
    main { padding: 22px 22px 18px; }
    h1 { margin: 0 0 10px; font-size: 16px; font-weight: 600; }
    p { margin: 0 0 8px; color: #a3a3a3; font-size: 13px; line-height: 1.5; }
    button {
      margin-top: 14px;
      background: #e8e8e8;
      color: #0a0a0a;
      border: 0;
      border-radius: 8px;
      padding: 8px 14px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main>
    <h1>正在等待键盘</h1>
    <p>还没有检测到名称包含 IQUNIX 或 EZ 的设备。请用数据线连接键盘，检测到后会自动选择。</p>
    <p>其他 HID 设备会忽略。最多等待 30 秒，也可点取消或关闭窗口。</p>
    <button type="button" id="cancel">取消</button>
  </main>
  <script>
    document.getElementById('cancel').addEventListener('click', function () {
      if (window.ezPrompt) window.ezPrompt.cancel();
    });
  </script>
</body>
</html>`;
}

function rememberFoundDevice(device) {
  if (!activeHid || !activeHid.window) return;
  if (!looksLikeIqunix(device)) return;
  if (activeHid.found.some((item) => item.deviceId === device.deviceId)) return;
  activeHid.found.push(device);
  if (activeHid.settleTimer) clearTimeout(activeHid.settleTimer);
  const token = activeHid.token;
  activeHid.settleTimer = setTimeout(() => {
    if (!activeHid || activeHid.token !== token) return;
    const found = activeHid.found.slice();
    if (found.length === 1) {
      settleHid(found[0].deviceId);
      return;
    }
    if (activeHid.window && !activeHid.window.isDestroyed()) {
      activeHid.window.removeAllListeners('closed');
      activeHid.window.destroy();
      activeHid.window = null;
    }
    if (activeHid.timer) {
      clearTimeout(activeHid.timer);
      activeHid.timer = null;
    }
    trackHidChoice(token, found);
  }, HID_SETTLE_MS);
}

function setupWebHid(ses) {
  if (!ses || hidSessions.has(ses)) return;
  hidSessions.add(ses);

  // 设备与剪贴板权限只给配置器站点。
  // 其它文档即使被加载，也不能获得复制、全屏等权限。
  ses.setPermissionCheckHandler((_webContents, _permission, requestingOrigin) => {
    return isTrustedConfiguratorUrl(requestingOrigin);
  });

  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const url = details && (details.requestingUrl || details.securityOrigin);
    if (permission === 'hid' || permission === 'usb' || permission === 'clipboard-read') {
      callback(isTrustedConfiguratorUrl(url));
      return;
    }
    callback(false);
  });

  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType !== 'hid' && details.deviceType !== 'usb') return false;
    return isTrustedConfiguratorUrl(details.origin);
  });

  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    settleHid('');
    const reply = onceCallback(callback);
    const frameUrl = frameUrlFrom(details && details.frame);
    if (frameUrl && !isTrustedConfiguratorUrl(frameUrl)) {
      reply('');
      return;
    }

    const list = details.deviceList || [];
    const matches = list.filter(looksLikeIqunix);
    // 一台匹配就直接连。多台让用户选。有设备但名称不符则取消。一台都没有才等待插入。
    if (matches.length === 1) {
      reply(matches[0].deviceId);
      return;
    }
    if (matches.length > 1) {
      trackHidChoice(startHidSelection(reply), matches);
      return;
    }
    if (list.length > 0) {
      reply('');
      return;
    }
    openHidWait(startHidSelection(reply));
  });

  ses.on('hid-device-added', (_event, details) => {
    const device = hidDeviceFrom(details);
    if (device) rememberFoundDevice(device);
  });

  ses.on('hid-device-removed', (_event, details) => {
    const device = hidDeviceFrom(details);
    if (!activeHid || !device) return;
    activeHid.found = activeHid.found.filter((item) => item.deviceId !== device.deviceId);
  });
}

function topInsetCss() {
  const n = TOP_CONTENT_INSET;
  return `
html {
  padding-top: ${n}px !important;
  box-sizing: border-box !important;
  min-height: 100%;
}
`;
}

async function applyTopContentInset(win) {
  if (!win || win.isDestroyed()) return;
  const prev = insetKeys.get(win);
  if (prev) {
    insetKeys.delete(win);
    try { await win.webContents.removeInsertedCSS(prev); } catch { /* 页面已经跳转 */ }
  }
  if (!loadSettings().topInset) return;
  try {
    const key = await win.webContents.insertCSS(topInsetCss(), { cssOrigin: 'user' });
    insetKeys.set(win, key);
  } catch (err) {
    console.warn('applyTopContentInset failed:', err && err.message);
  }
}

function navigateHome() {
  if (!isLiveWindow(mainWindow)) return;
  if (isOnline()) {
    mainWindow.loadURL(APP_URL);
    return;
  }
  mainWindow.loadURL(APP_URL).catch(() => {
    mainWindow.loadFile(offlinePageUrl());
  });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createWindow() {
  const saved = loadBounds();
  const hidden = initialHiddenLaunch;
  initialHiddenLaunch = false;
  const windowOptions = {
    width: saved.width,
    height: saved.height,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'EZ Desktop Shell',
    icon: createNativeIcon(),
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#e8e8e8',
      height: TITLE_BAR_HEIGHT
    },
    webPreferences: lockedWebPreferences({
      preload: undefined,
      spellcheck: false
    })
  };
  if (typeof saved.x === 'number' && typeof saved.y === 'number') {
    windowOptions.x = saved.x;
    windowOptions.y = saved.y;
  }

  const win = new BrowserWindow(windowOptions);

  mainWindow = win;
  setupWebHid(win.webContents.session);

  const applyInset = () => { applyTopContentInset(win); };
  win.webContents.on('dom-ready', applyInset);
  win.webContents.on('did-finish-load', applyInset);
  win.webContents.on('did-navigate-in-page', applyInset);

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return;
    console.warn('did-fail-load', errorCode, errorDescription, validatedURL);
    if (!isOnline() || OFFLINE_ERROR_CODES.has(errorCode)) {
      win.loadFile(offlinePageUrl());
    }
  });

  // 点关闭只是收进托盘，真正退出走托盘菜单。
  win.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    flushSaveBounds();
    win.hide();
  });

  for (const eventName of ['resize', 'move', 'maximize', 'unmaximize']) {
    win.on(eventName, scheduleSaveBounds);
  }

  win.once('ready-to-show', () => {
    if (saved.isMaximized) win.maximize();
    if (!hidden) win.show();
  });

  navigateHome();
  return win;
}

function getOpenAtLogin() {
  if (!app.isPackaged) return false;
  try {
    const settings = app.getLoginItemSettings({
      path: appExecutablePath(),
      args: ['--hidden']
    });
    return !!settings.openAtLogin;
  } catch {
    return false;
  }
}

function setOpenAtLogin(enabled) {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({
    openAtLogin: !!enabled,
    openAsHidden: true,
    path: appExecutablePath(),
    args: ['--hidden']
  });
}

/** 旧版本曾把开机启动登记到便携包的临时解压路径上，这里清掉那条无效记录。 */
function clearExtractedLoginItem() {
  if (!app.isPackaged || !process.env.PORTABLE_EXECUTABLE_FILE) return;
  const launched = appExecutablePath();
  if (path.normalize(launched).toLowerCase() === path.normalize(process.execPath).toLowerCase()) return;
  try {
    app.setLoginItemSettings({ openAtLogin: false, path: process.execPath, args: ['--hidden'] });
    app.setLoginItemSettings({ openAtLogin: false, path: process.execPath, args: [] });
  } catch (err) {
    console.warn('Failed to clear stale login item:', err);
  }
}

async function clearAppCache() {
  const ses = session.defaultSession;
  await ses.clearCache();
  await ses.clearStorageData({
    storages: ['cachestorage', 'serviceworkers', 'shadercache']
  });
  if (isLiveWindow(mainWindow)) {
    navigateHome();
  }
}

function buildTrayMenu() {
  const openAtLogin = getOpenAtLogin();
  const topInset = loadSettings().topInset;
  return Menu.buildFromTemplate([
    {
      label: `版本 ${app.getVersion()}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: '显示',
      click: () => showMainWindow()
    },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => {
        if (!app.isPackaged) {
          item.checked = false;
          dialog.showMessageBox({
            type: 'info',
            title: '开机启动',
            message: '开发运行时不能设置开机启动',
            detail: '请使用打包后的便携版。开机启动会指向你双击的那个 exe，而不是临时解压副本。'
          });
          return;
        }
        setOpenAtLogin(item.checked);
      }
    },
    {
      label: '顶部留白',
      type: 'checkbox',
      checked: topInset,
      click: (item) => {
        saveSettings({ topInset: item.checked });
        if (isLiveWindow(mainWindow)) applyTopContentInset(mainWindow);
      }
    },
    { type: 'separator' },
    {
      label: '刷新 / 清除缓存',
      click: async () => {
        try {
          await clearAppCache();
        } catch (err) {
          dialog.showErrorBox('缓存', String(err));
        }
      }
    },
    {
      label: '重新加载页面',
      click: () => {
        if (isLiveWindow(mainWindow)) {
          if (isOnline()) mainWindow.loadURL(APP_URL);
          else navigateHome();
        }
      }
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => {
        checkForUpdates({ silent: false }).catch(() => {});
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        flushSaveBounds();
        app.quit();
      }
    }
  ]);
}

function refreshTrayIcon() {
  if (!tray) return;
  const image = createTrayIcon();
  if (!image.isEmpty()) tray.setImage(image);
}

function createTray() {
  const image = createTrayIcon();
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('EZ Desktop Shell（非官方）');
  tray.setContextMenu(buildTrayMenu());
  const onTrayClick = () => showMainWindow();
  tray.on('click', onTrayClick);
  tray.on('double-click', onTrayClick);
  tray.on('right-click', () => {
    tray.setContextMenu(buildTrayMenu());
  });
  // DPI / 显示器变化时换一套匹配像素尺寸的图标，避免被系统拉伸发糊。
  screen.on('display-metrics-changed', refreshTrayIcon);
}

ipcMain.on('ez-prompt-cancel', (event) => {
  if (!activeHid || !activeHid.window || activeHid.window.isDestroyed()) return;
  if (event.sender !== activeHid.window.webContents) return;
  settleHid('');
});

/** 第二次启动只把已有窗口唤到前台。 */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => {
      event.preventDefault();
    });
    attachNavigationGuard(contents);
  });

  app.on('second-instance', () => {
    initialHiddenLaunch = false;
    if (app.isReady()) showMainWindow();
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.leocodelab.ez-desktop-shell');
    }
    clearExtractedLoginItem();
    setupWebHid(session.defaultSession);
    createTray();
    createWindow();
    setTimeout(() => {
      checkForUpdates({ silent: true }).catch(() => {});
    }, 8000);
  });

  app.on('before-quit', () => {
    isQuitting = true;
    flushSaveBounds();
  });

  app.on('window-all-closed', () => {
    // 窗口全关后继续留在托盘。
  });

  app.on('activate', () => {
    showMainWindow();
  });
}
