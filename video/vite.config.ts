import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { releaseDatesPlugin } from "../scripts/vite/release-dates.mjs";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), releaseDatesPlugin()],
  clearScreen: false,
  server: { port: 1430, strictPort: false, fs: { allow: [".."] } },
});
