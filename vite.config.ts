import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fontScaleCssPlugin } from "./scripts/vite/font-scale.mjs";
import { releaseDatesPlugin } from "./scripts/vite/release-dates.mjs";
import { createWatchIgnored } from "./scripts/vite/watch-ignored.mjs";

const VIRTUAL_DEV_I18N_ID = "\0fuyu-empty-dev-i18n";
const VIRTUAL_PROD_TRANSLATIONS_ID = "\0fuyu-empty-translations";

function stripDevI18nPlugin() {
  return {
    name: "fuyu-strip-dev-i18n",
    apply: "build" as const,
    enforce: "pre" as const,
    async resolveId(source: string, importer: string | undefined, options: { attributes?: Record<string, string>; custom?: Record<string, unknown>; isEntry?: boolean }) {
      if (!importer || importer.startsWith("\0")) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      const cleanId = resolved?.id.split("?")[0].replace(/\\/g, "/");
      if (cleanId?.endsWith("/src/i18n/devFallback.ts")) return VIRTUAL_DEV_I18N_ID;
      if (cleanId?.endsWith("/src/i18n/translations.ts")) return VIRTUAL_PROD_TRANSLATIONS_ID;
      return null;
    },
    load(id: string) {
      if (id === VIRTUAL_DEV_I18N_ID) return "export const devTranslations = undefined;";
      if (id === VIRTUAL_PROD_TRANSLATIONS_ID) return "export const TRANSLATIONS = {};";
      return null;
    },
  };
}

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [stripDevI18nPlugin(), fontScaleCssPlugin(), react(), releaseDatesPlugin()],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const clean = id.replace(/\\/g, "/");
          if (
            clean.includes("/src/i18n/sections/") &&
            !clean.includes("/src/i18n/sections/settings/") &&
            !clean.endsWith("/src/i18n/sections/onboarding.ts") &&
            !clean.endsWith("/src/i18n/sections/screenshot.ts") &&
            !clean.endsWith("/src/i18n/sections/common.ts")
          ) {
            return "i18n-core";
          }
          return undefined;
        },
      },
    },
  },

  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: {
      overlay: false,
      ...(host ? { protocol: "ws", host, port: 1421 } : {}),
    },
    watch: {
      ignored: [createWatchIgnored()],
    },
  },
}));
