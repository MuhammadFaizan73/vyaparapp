import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron, { startup } from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        onstart() {
          startup();
        },
        vite: { build: { outDir: "dist-electron" } },
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
        vite: { build: { outDir: "dist-electron" } },
      },
    ]),
    renderer(),
  ],
  server: { port: 5173 },
});
