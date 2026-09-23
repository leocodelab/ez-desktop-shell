'use strict';

const path = require('path');
const fs = require('fs');
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  session,
  shell,
  dialog,
  net
} = require('electron');
const { checkForUpdates } = require('./updater');

const APP_URL = 'https://ez.iqunix.com/';
const BOUNDS_FILE = () => path.join(app.getPath('userData'), 'window-bounds.json');
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 800;
const TITLE_BAR_HEIGHT = 44;
/** CSS inset so site chrome is not under the overlay controls. */
const TOP_CONTENT_INSET = TITLE_BAR_HEIGHT;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Tray | null} */
let tray = null;
let isQuitting = false;
/** Sessions we already wired for WebHID (avoid duplicate listeners). */
const hidSessions = new WeakSet();

function isHiddenLaunch() {
  return process.argv.includes('--hidden');
}

function loadBounds() {
  try {
    const raw = fs.readFileSync(BOUNDS_FILE(), 'utf8');
    const data = JSON.parse(raw);
    if (
      typeof data.x === 'number' &&
      typeof data.y === 'number' &&
      typeof data.width === 'number' &&
      typeof data.height === 'number'
    ) {
      return {
        x: data.x,
        y: data.y,
        width: Math.max(data.width, MIN_WIDTH),
        height: Math.max(data.height, MIN_HEIGHT)
      };
    }
  } catch {
    /* first run or corrupt file */
  }
  return { width: MIN_WIDTH, height: MIN_HEIGHT };
}

function saveBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    if (mainWindow.isMinimized() || !mainWindow.isVisible()) return;
    const bounds = mainWindow.getBounds();
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(BOUNDS_FILE(), JSON.stringify(bounds, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to save window bounds:', err);
  }
}

function iconPath(preferred) {
  const candidates = preferred.concat([
    path.join(__dirname, '..', 'assets', 'icon.ico'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(process.resourcesPath || '', 'assets', 'icon.ico'),
    path.join(process.resourcesPath || '', 'assets', 'icon.png')
  ]);
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function createNativeIcon() {
  const p = iconPath([]);
  if (!p) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(p);
  return img.isEmpty() ? nativeImage.createEmpty() : img;
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
  return hay.includes('iqunix') || hay.includes('ez series') || hay.includes('iqx');
}

function onceCallback(callback) {
  let done = false;
  return (deviceId) => {
    if (done) return;
    done = true;
    try {
      callback(deviceId);
    } catch (err) {
      console.warn('HID select callback error:', err);
    }
  };
}

function pickHidDevice(deviceList) {
  const list = deviceList || [];
  if (list.length === 0) return null;
  return list.find(looksLikeIqunix) || (list.length === 1 ? list[0] : list[0]);
}

function setupWebHid(ses) {
  if (!ses || hidSessions.has(ses)) return;
  hidSessions.add(ses);

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    if (permission === 'hid' || permission === 'usb' || permission === 'clipboard-read') {
      callback(true);
      return;
    }
    callback(false);
  });

  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'hid' || details.deviceType === 'usb') {
      return true;
    }
    return false;
  });

  // Pending one-shot selector while waiting for a newly plugged device.
  let pendingSelect = null;

  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const reply = onceCallback(callback);

    if (pendingSelect && pendingSelect.timer) {
      clearTimeout(pendingSelect.timer);
      pendingSelect = null;
    }

    const chosen = pickHidDevice(details.deviceList);
    if (chosen) {
      reply(chosen.deviceId);
      return;
    }

    // Empty list: wait briefly for plug-in, then cancel once.
    pendingSelect = {
      reply,
      timer: setTimeout(() => {
        if (pendingSelect && pendingSelect.reply === reply) {
          pendingSelect = null;
          reply('');
        }
      }, 30000)
    };
  });

  ses.on('hid-device-added', (_event, device) => {
    if (!pendingSelect) return;
    if (!looksLikeIqunix(device) && !(pendingSelect)) return;
    const { reply, timer } = pendingSelect;
    clearTimeout(timer);
    pendingSelect = null;
    reply(device.deviceId);
  });

  ses.on('hid-device-removed', () => {
    /* no-op */
  });
}


function topInsetCss() {
  const n = TOP_CONTENT_INSET;
  return `
:root { --ez-shell-top-inset: ${n}px; }
html {
  padding-top: var(--ez-shell-top-inset) !important;
  box-sizing: border-box !important;
  min-height: 100%;
}
body [style*="position: fixed"][style*="top: 0"],
body [style*="position:fixed"][style*="top:0"],
body [style*="position: sticky"][style*="top: 0"],
body [style*="position:sticky"][style*="top:0"] {
  top: var(--ez-shell-top-inset) !important;
}
`;
}
async function applyTopContentInset(win) {
  if (!win || win.isDestroyed()) return;
  try { await win.webContents.insertCSS(topInsetCss(), { cssOrigin: 'user' }); }
  catch (err) { console.warn('applyTopContentInset failed:', err && err.message); }
}
function navigateHome() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isOnline()) {
    mainWindow.loadURL(APP_URL);
    return;
  }
  mainWindow.loadURL(APP_URL).catch(() => {
    mainWindow.loadFile(offlinePageUrl());
  });
}

function createWindow() {
  const bounds = loadBounds();
  const win = new BrowserWindow({
    ...bounds,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    title: 'EZ Desktop Shell',
    icon: createNativeIcon(),
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    // Dark native title bar (Windows) to match IQUNIX dark UI.
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#e8e8e8',
      height: TITLE_BAR_HEIGHT
    },
    webPreferences: {
      preload: undefined,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false
    }
  });

  mainWindow = win;
  // Window uses defaultSession; setup already done in whenReady. Guarded if not.
  setupWebHid(win.webContents.session);

  const applyInset = () => { applyTopContentInset(win); };
  win.webContents.on('dom-ready', applyInset);
  win.webContents.on('did-finish-load', applyInset);
  win.webContents.on('did-navigate-in-page', applyInset);



  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    if (errorCode === -3) return;
    console.warn('did-fail-load', errorCode, errorDescription, validatedURL);
    if (!isOnline() || errorCode === -106 || errorCode === -105 || errorCode === -2) {
      win.loadFile(offlinePageUrl());
    }
  });

  win.on('close', (e) => {
    if (isQuitting) return;
    e.preventDefault();
    saveBounds();
    win.hide();
  });

  win.on('resize', () => saveBounds());
  win.on('move', () => saveBounds());

  win.once('ready-to-show', () => {
    if (!isHiddenLaunch()) {
      win.maximize();
      win.show();
    }
  });

  navigateHome();
  return win;
}

function getOpenAtLogin() {
  try {
    const settings = app.getLoginItemSettings();
    return !!settings.openAtLogin;
  } catch {
    return false;
  }
}

function setOpenAtLogin(enabled) {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    path: process.execPath,
    args: enabled ? ['--hidden'] : []
  });
}

async function clearAppCache() {
  const ses = session.defaultSession;
  await ses.clearCache();
  await ses.clearStorageData({
    storages: ['cachestorage', 'serviceworkers', 'shadercache']
  });
  if (mainWindow && !mainWindow.isDestroyed()) {
    navigateHome();
  }
}

function buildTrayMenu() {
  const openAtLogin = getOpenAtLogin();
  return Menu.buildFromTemplate([
    {
      label: '显示',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '开机启动',
      type: 'checkbox',
      checked: openAtLogin,
      click: (item) => setOpenAtLogin(item.checked)
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
        if (mainWindow && !mainWindow.isDestroyed()) {
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
        saveBounds();
        app.quit();
      }
    }
  ]);
}

function createTray() {
  const image = createNativeIcon();
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  tray.setToolTip('EZ Desktop Shell（非官方）');
  tray.setContextMenu(buildTrayMenu());
  tray.on('double-click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
  tray.on('right-click', () => {
    tray.setContextMenu(buildTrayMenu());
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.leocodelab.ez-desktop-shell');
    }
    setupWebHid(session.defaultSession);
    createTray();
    createWindow();
    setTimeout(() => {
      checkForUpdates({ silent: true }).catch(() => {});
    }, 8000);
  });

  app.on('before-quit', () => {
    isQuitting = true;
    saveBounds();
  });

  app.on('window-all-closed', () => {
    // Keep running in the tray.
  });

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
}
