import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("vyapar", {
  platform: process.platform,
  version: process.versions.electron,
  getAppVersion: () => ipcRenderer.invoke("app:get-version"),
});
