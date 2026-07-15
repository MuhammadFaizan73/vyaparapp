import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("vyapar", {
  platform: process.platform,
  version: process.versions.electron,
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-for-updates"),
  onUpdateStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: unknown, status: unknown) => callback(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
});
