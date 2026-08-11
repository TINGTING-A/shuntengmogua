const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),

  clipboardWrite: (text) => ipcRenderer.invoke("clipboard-write-text", text),
  clipboardRead: () => ipcRenderer.invoke("clipboard-read-text"),

  selectFolder: () => ipcRenderer.invoke("select-folder"),
  openFolder: (dirPath) => ipcRenderer.invoke("open-folder", dirPath),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  getAppInfo: () => ipcRenderer.invoke("get-app-info"),
  checkUpdates: () => ipcRenderer.invoke("check-for-updates"),

  browserCreate: (url, sessionName) => ipcRenderer.invoke("browser:create-window", { url, sessionName }),
  browserClose: (id) => ipcRenderer.invoke("browser:close-window", id),
  browserGetWindows: () => ipcRenderer.invoke("browser:get-windows"),

  isElectron: true,
});
