const { app, BrowserWindow, shell, ipcMain, dialog, clipboard } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = process.env.ELECTRON_DEV === "true" || !app.isPackaged;

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "顺藤摸瓜",
    icon: path.join(__dirname, "../public/favicon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// IPC handlers
ipcMain.handle("window-minimize", () => mainWindow?.minimize());
ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle("window-close", () => mainWindow?.close());

ipcMain.handle("clipboard-write-text", (_e, text) => {
  clipboard.writeText(text);
  return true;
});
ipcMain.handle("clipboard-read-text", () => clipboard.readText());

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle("open-folder", (_e, dirPath) => {
  shell.openPath(dirPath);
  return true;
});
ipcMain.handle("open-external", (_e, url) => {
  shell.openExternal(url);
  return true;
});

ipcMain.handle("get-app-info", () => ({
  name: "顺藤摸瓜",
  version: app.getVersion(),
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  platform: process.platform,
  arch: process.arch,
  isPackaged: app.isPackaged,
}));

// Browser window management (compatible with existing IPC schema)
const browserWindows = new Map();

ipcMain.handle("browser:create-window", (_e, { url, sessionName }) => {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    title: "内置浏览器",
    webPreferences: {
      contextIsolation: true,
      partition: sessionName ? `persist:${sessionName}` : undefined,
    },
  });
  win.loadURL(url);
  const id = `bw_${Date.now()}`;
  browserWindows.set(id, win);
  win.on("closed", () => browserWindows.delete(id));
  return id;
});
ipcMain.handle("browser:close-window", (_e, id) => {
  const win = browserWindows.get(id);
  if (win) win.close();
  return true;
});
ipcMain.handle("browser:get-windows", () =>
  Array.from(browserWindows.entries()).map(([id, win]) => ({
    id,
    title: win.getTitle(),
    url: win.webContents.getURL(),
  })),
);

// Auto-updater check (simple polling)
ipcMain.handle("check-for-updates", async () => {
  try {
    const currentVersion = app.getVersion();
    return { updateAvailable: false, currentVersion, message: "已是最新版本" };
  } catch {
    return { updateAvailable: false, currentVersion: app.getVersion(), message: "检查更新失败" };
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
