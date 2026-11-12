// `pnpm dev:lane`: runs this lane's island as a preview next to the user's own.
// Plain `pnpm tauri dev` would stop every running island first and needs port
// 1420, which the main checkout's dev server uses. The preview instead:
//   - serves Vite on 1500 + <lane number>;
//   - puts its exe in src-tauri/target/lane-<N> of the main checkout, and compiles
//     in target/lane-build, which every lane shares (cargo's build-dir), so only
//     the first preview builds the dependencies;
//   - runs as com.tixxin.fuyu.lane-<N> (FOCUSD_DEV_LANE, src-tauri/src/dev_lane.rs),
//     with its own data, and without touching focusd:// links, launch at
//     startup or the agents' status hooks.
// It starts with empty data; the user's island keeps running. It sits on the left quarter of
// the screen so it does not cover the user's island; `--center` (`pnpm dev:lane:center`) puts it
// at the top centre like a real install, e.g. to check the first-run guide where users see it.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lanePreview, laneNumber, mainCheckout } from "./build-dirs.mjs";
import { backgroundBuildEnv } from "./build-load.mjs";

/** The `tauri dev --config` override for a preview on `port`. */
export function previewConfig(port) {
  return {
    build: {
      devUrl: `http://localhost:${port}`,
      // Not the default beforeDevCommand, which stops every running island.
      beforeDevCommand: `pnpm exec vite --port ${port} --strictPort`,
    },
  };
}

function main() {
  const root = process.cwd();
  const lane = laneNumber(root);
  if (lane === null) {
    console.error("pnpm dev:lane runs in a lane (../fly-island-lanes/<N>). In the main checkout use pnpm tauri dev.");
    return Promise.resolve(1);
  }
  const preview = lanePreview(mainCheckout(root), lane);
  const centred = process.argv.includes("--center");
  const configFile = path.join(tmpdir(), `fly-island-lane-${lane}.tauri.json`);
  writeFileSync(configFile, JSON.stringify(previewConfig(preview.port)));
  console.log(`[dev:lane] lane ${lane}: ${preview.identifier}, Vite on ${preview.port}, exe in ${preview.target}, compiling in ${preview.buildDir}${centred ? ", at the top centre" : ""}`);
  console.log("[dev:lane] The first preview on this machine builds the dependencies (a few minutes); later lanes reuse them. Close the preview from its tray icon or with Ctrl+C.");
  const child = spawn(`pnpm tauri dev --config "${configFile}"`, {
    shell: true,
    stdio: "inherit",
    // Fewer rustc jobs, but normal priority: the user is watching this preview.
    // Another preview compiling at the same time waits on the build-dir's lock.
    env: { ...process.env, CARGO_TARGET_DIR: preview.target, CARGO_BUILD_BUILD_DIR: preview.buildDir, FOCUSD_DEV_LANE: String(lane), FOCUSD_DEV_LANE_CENTER: centred ? "1" : "0", ...backgroundBuildEnv() },
  });
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
