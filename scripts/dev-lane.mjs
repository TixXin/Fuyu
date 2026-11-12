import { spawn } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lanePreview, laneNumber, mainCheckout } from "./build-dirs.mjs";
import { backgroundBuildEnv } from "./build-load.mjs";

export function previewConfig(port) {
  return {
    build: {
      devUrl: `http://localhost:${port}`,
      beforeDevCommand: `pnpm exec vite --port ${port} --strictPort`,
    },
  };
}

export function previewDataDirs(identifier, env = process.env) {
  if (!identifier.startsWith("com.tixxin.fuyu.lane-")) throw new Error(`Not a lane preview: ${identifier}`);
  return [env.APPDATA, env.LOCALAPPDATA].filter(Boolean).map((base) => path.join(base, identifier));
}

function clearPreviewData(identifier) {
  for (const dir of previewDataDirs(identifier)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch (error) {
      console.error(`[dev:lane] Could not delete ${dir} (${error.code ?? error}). Close the running preview first (its tray icon, or Ctrl+C).`);
      return false;
    }
  }
  return true;
}

function main() {
  const root = process.cwd();
  const lane = laneNumber(root);
  if (lane === null) {
    console.error("pnpm dev:lane runs in a lane (pnpm lane:open). In the main checkout use pnpm tauri dev.");
    return Promise.resolve(1);
  }
  const preview = lanePreview(mainCheckout(root), lane);
  const centred = process.argv.includes("--center");
  if (process.argv.includes("--fresh")) {
    if (!clearPreviewData(preview.identifier)) return Promise.resolve(1);
    console.log(`[dev:lane] --fresh: deleted ${preview.identifier}'s data; it starts like a new install.`);
  }
  const configFile = path.join(tmpdir(), `fly-island-lane-${lane}.tauri.json`);
  writeFileSync(configFile, JSON.stringify(previewConfig(preview.port)));
  console.log(`[dev:lane] lane ${lane}: ${preview.identifier}, Vite on ${preview.port}, exe in ${preview.target}, compiling in ${preview.buildDir}${centred ? ", at the top centre" : ""}`);
  console.log("[dev:lane] The first preview on this machine builds the dependencies (a few minutes); later lanes reuse them. Close the preview from its tray icon or with Ctrl+C.");
  const child = spawn(`pnpm tauri dev --config "${configFile}"`, {
    shell: true,
    stdio: "inherit",
    env: { ...process.env, CARGO_TARGET_DIR: preview.target, CARGO_BUILD_BUILD_DIR: preview.buildDir, FOCUSD_DEV_LANE: String(lane), FOCUSD_DEV_LANE_CENTER: centred ? "1" : "0", ...backgroundBuildEnv() },
  });
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
