'use strict';

/**
 * electron-builder 便携版会把程序解压到临时目录再运行。
 * process.execPath 指向那份临时副本；用户双击的 exe 在 PORTABLE_EXECUTABLE_FILE 里。
 */
function appExecutablePath() {
  const portable = process.env.PORTABLE_EXECUTABLE_FILE;
  if (typeof portable === 'string' && portable.trim()) return portable;
  return process.execPath;
}

module.exports = { appExecutablePath };
