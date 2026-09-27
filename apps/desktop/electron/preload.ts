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
  // Writes the file directly via the main process's fs — unlike a Blob/`<a download>`
  // browser download, this never goes through Chromium's download manager, so Windows
  // never tags it with the internet "Mark of the Web" that makes Excel open it in
  // Protected View (forcing an "Enable Editing" click before the file is usable).
  // Returns the saved path, or null if the user cancelled the save dialog.
  saveBinaryFile: (suggestedName: string, data: Uint8Array): Promise<string | null> =>
    ipcRenderer.invoke("file:save-binary", suggestedName, data),
});
