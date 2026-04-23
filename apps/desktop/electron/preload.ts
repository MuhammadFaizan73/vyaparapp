import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("vyapar", {
  platform: process.platform,
  version: process.versions.electron,
});
