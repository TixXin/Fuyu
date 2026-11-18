import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import viteConfig from "../../vite.config.ts";
import {
  WATCH_IGNORED_GLOBS,
  createWatchIgnored,
  isWatchIgnored,
} from "../../scripts/vite/watch-ignored.mjs";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const IGNORED_PATHS = [
  "plugins/v3/official/pomodoro/tsconfig.json",
  "plugins/v3/official/github-issues/tsconfig.json",
  "tests/regression/snapshots/settings-feature-off.html",
  "tests/regression/snapshots/settings-feature-off.light.html",
  "src-tauri/src/agent_approval/decision.rs",
  "docs/tasks/G/G2.3.md",
  "video/package.json",
  ".claude/skills/fuyu-task/SKILL.md",
];

const WATCHED_PATHS = [
  "src/main.tsx",
  "src/windows/island/IslandApp.tsx",
  "src/features/media/plugin/runners.tsx",
  "src/features/plugin-kernel/slots.ts",
  "tests/regression/agent-sessions.tsx",
  "tests/regression/agent-sessions.html",
  "packages/plugin-base/src/index.ts",
  "index.html",
];

test("WATCH_IGNORED_GLOBS covers non-runtime workspace directories", () => {
  assert.deepEqual(WATCH_IGNORED_GLOBS, [
    "**/src-tauri/**",
    "**/plugins/**",
    "**/tests/regression/snapshots/**",
    "**/docs/**",
    "**/video/**",
    "**/.claude/**",
  ]);
});

test("isWatchIgnored filters non-runtime paths while preserving HMR targets", () => {
  for (const relPath of IGNORED_PATHS) {
    assert.equal(isWatchIgnored(relPath, REPO_ROOT), true, `expected ignored: ${relPath}`);
    assert.equal(isWatchIgnored(join(REPO_ROOT, relPath), REPO_ROOT), true, `expected ignored abs: ${relPath}`);
  }

  for (const relPath of WATCHED_PATHS) {
    assert.equal(isWatchIgnored(relPath, REPO_ROOT), false, `expected watched: ${relPath}`);
    assert.equal(isWatchIgnored(join(REPO_ROOT, relPath), REPO_ROOT), false, `expected watched abs: ${relPath}`);
  }

  assert.equal(isWatchIgnored(REPO_ROOT, REPO_ROOT), false);
});

test("createWatchIgnored normalizes Windows drive letters and backslashes", () => {
  const matcher = createWatchIgnored("C:\\Users\\dev\\Fuyu");
  assert.equal(matcher("c:\\Users\\dev\\Fuyu\\plugins\\v3\\official\\pomodoro\\tsconfig.json"), true);
  assert.equal(matcher("C:\\Users\\dev\\Fuyu\\tests\\regression\\snapshots\\settings-feature-off.html"), true);
  assert.equal(matcher("C:\\Users\\dev\\Fuyu\\src\\features\\plugins\\PluginsSettings.tsx"), false);
  assert.equal(matcher("C:\\Users\\dev\\Fuyu\\tests\\regression\\agent-sessions.tsx"), false);
});

test("vite.config.ts server.watch.ignored ignores parallel session artifacts in Vite watcher", async () => {
  const resolved = typeof viteConfig === "function"
    ? await viteConfig({ command: "serve", mode: "development" })
    : viteConfig;
  const tempRoot = mkdtempSync(join(tmpdir(), "fuyu-vite-watch-"));
  const server = await createServer({
    root: tempRoot,
    configFile: false,
    logLevel: "silent",
    optimizeDeps: { noDiscovery: true },
    server: {
      middlewareMode: true,
      ws: false,
      watch: resolved.server?.watch,
    },
  });

  try {
    for (const relPath of IGNORED_PATHS) {
      assert.equal(
        server.watcher._isIgnored(join(REPO_ROOT, relPath)),
        true,
        `expected Vite watcher to ignore ${relPath}`,
      );
    }

    for (const relPath of WATCHED_PATHS) {
      assert.equal(
        server.watcher._isIgnored(join(REPO_ROOT, relPath)),
        false,
        `expected Vite watcher to watch ${relPath}`,
      );
    }
  } finally {
    await server.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
