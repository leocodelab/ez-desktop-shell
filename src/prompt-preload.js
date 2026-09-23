'use strict';

// 等待窗口在沙箱里，取消按钮通过这里通知主进程。

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ezPrompt', {
  cancel: () => ipcRenderer.send('ez-prompt-cancel')
});
