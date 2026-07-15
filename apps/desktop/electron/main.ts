import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import { autoUpdater } from "electron-updater";

const isDev = !app.isPackaged;

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;

  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Update ready",
        message: `A new version (${info.version}) has been downloaded.`,
        detail: "Restart Godigi now to apply the update?",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-update error:", err);
  });

  autoUpdater.checkForUpdates();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    title: "Godigi",
    icon: path.join(__dirname, "../buildResources/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.maximize();
  win.show();

  if (isDev) {
    win.loadURL("http://localhost:5174");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("app:get-version", () => app.getVersion());

app.whenReady().then(() => {
  createWindow();
  if (!isDev) setupAutoUpdater();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
