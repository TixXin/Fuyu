import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { SLOT_THEME } from "../../packages/plugin-base/src/protocol.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { review } from "../../packages/plugin-review/src/index.mjs";
import { mediaV1, messagesV1, timersV1, todosV1 } from "../../packages/plugin-services/src/index.mjs";
import { filterApps, rankApps, recordAppLaunch } from "../../plugins/v3/official/launcher/src/model.ts";
import { buildLaunchSpec, defaultAppRoots, scanApplications } from "../../plugins/v3/official/launcher/src/scanner.ts";

const OFFICIAL_ROOT = fileURLToPath(new URL("../../plugins/v3/official", import.meta.url));
const OFFICIAL_PLUGINS = [
  "pomodoro",
  "todo-digest",
  "todo-ring",
  "now-playing",
  "weather",
  "github-issues",
  "system-monitor",
  "launcher",
];

const scratch = mkdtempSync(join(tmpdir(), "fuyu-official-plugins-v3-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

function collectCssFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...collectCssFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      found.push(full);
    }
  }
  return found;
}

test("all 8 official v3 plugins pass check, pack, review, slot theme checks, and run together in startHost", async () => {
  const packedById = new Map();

  for (const slug of OFFICIAL_PLUGINS) {
    const dir = join(OFFICIAL_ROOT, slug);
    const expectedId = `@fuyu/${slug}`;

    assert.equal(existsSync(join(dir, "dist")), false, `${expectedId} source directory must not keep dist/`);
    assert.equal(existsSync(join(dir, "build")), false, `${expectedId} source directory must not keep build/`);

    const checkResult = await check(dir, { official: true, allowExperimental: false });
    assert.equal(checkResult.ok, true, `${expectedId} check errors: ${JSON.stringify(checkResult.errors)}`);
    assert.deepEqual(checkResult.errors, [], `${expectedId} check errors must be empty`);
    if (slug === "launcher") {
      assert.ok(
        checkResult.warnings.every((item) => item.code === "review:sensitive"),
        `${expectedId} check warnings must only contain review:sensitive notices, got ${JSON.stringify(checkResult.warnings)}`,
      );
    } else {
      assert.deepEqual(checkResult.warnings, [], `${expectedId} check warnings must be empty`);
    }

    const outDir = join(scratch, "built", slug);
    const packDir = join(scratch, "packed", slug);
    const packed = await pack(dir, {
      official: true,
      allowExperimental: false,
      outDir,
      packDir,
    });
    assert.equal(packed.manifest.name, expectedId);
    assert.equal(existsSync(packed.file), true, `${expectedId} must produce a .fuyu package`);
    assert.ok(packed.file.endsWith(".fuyu"));
    assert.ok(statSync(packed.file).size > 0);
    if (slug === "system-monitor") {
      assert.ok(
        Array.isArray(packed.manifest.fuyu.nodeApis) && packed.manifest.fuyu.nodeApis.includes("os"),
        `@fuyu/system-monitor built manifest must declare "os" in fuyu.nodeApis, got ${JSON.stringify(packed.manifest.fuyu.nodeApis)}`,
      );
    }
    if (slug === "launcher") {
      assert.deepEqual(packed.manifest.fuyu.nodeApis, ["child_process", "fs", "os", "path"]);
    }

    const report = review({
      oldDir: null,
      newDir: dir,
      newBuilt: packed.outDir,
    });
    assert.notEqual(report.tier, "red", `${expectedId} review tier must not be red`);
    const redFindings = report.findings.filter((item) => item.tier === "red");
    assert.deepEqual(redFindings, [], `${expectedId} review must have zero red findings`);
    assert.deepEqual(report.summary.network.undeclared, [], `${expectedId} must have zero undeclared network hosts`);

    const cssFiles = collectCssFiles(dir);
    assert.ok(cssFiles.length > 0, `${expectedId} should include at least one .css stylesheet`);
    for (const cssFile of cssFiles) {
      const css = readFileSync(cssFile, "utf8");
      assert.doesNotMatch(
        css,
        /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i,
        `${expectedId} (${cssFile}) must not hardcode #hex, rgb(), or hsl() colors`,
      );
      const vars = [...css.matchAll(/var\(\s*(--[\w-]+)/g)].map(([, name]) => name);
      assert.ok(vars.length > 0, `${expectedId} (${cssFile}) should use --fuyu-plugin-* theme variables`);
      const invalidVars = vars.filter((name) => !SLOT_THEME.includes(name));
      assert.deepEqual(invalidVars, [], `${expectedId} (${cssFile}) uses non-SLOT_THEME variables: ${invalidVars.join(", ")}`);
    }

    packedById.set(expectedId, packed);
  }

  const fakeAppsDir = join(scratch, "fake-apps");
  mkdirSync(join(fakeAppsDir, "Visual Studio Code.app"), { recursive: true });
  mkdirSync(join(fakeAppsDir, "Calculator.app"), { recursive: true });
  mkdirSync(join(fakeAppsDir, "Utilities", "Activity Monitor.app"), { recursive: true });
  mkdirSync(join(fakeAppsDir, "Uninstall Tool.app"), { recursive: true });
  writeFileSync(join(fakeAppsDir, "Visual Studio Code.lnk"), "");
  writeFileSync(join(fakeAppsDir, "Calculator.lnk"), "");
  mkdirSync(join(fakeAppsDir, "Utilities"), { recursive: true });
  writeFileSync(join(fakeAppsDir, "Utilities", "Activity Monitor.url"), "");
  writeFileSync(join(fakeAppsDir, "Uninstall Tool.lnk"), "");

  const prevAppDirs = process.env.FUYU_LAUNCHER_APP_DIRS;
  const prevDryRun = process.env.FUYU_LAUNCHER_DRY_RUN;
  process.env.FUYU_LAUNCHER_APP_DIRS = fakeAppsDir;
  process.env.FUYU_LAUNCHER_DRY_RUN = "1";

  const hostDir = join(scratch, "host-data");
  mkdirSync(hostDir, { recursive: true });
  for (const [expectedId, packed] of packedById) {
    const installed = installPackage(packed.file, {
      dir: hostDir,
      source: "market",
      expectedSha256: packed.sha256,
    });
    assert.equal(installed.id, expectedId);
  }

  let host = null;
  const providers = [];
  try {
    host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
    providers.push(
      host.ctx.services.provide(timersV1, {
        list: async () => ({ timers: [], at: Date.now() }),
        start: async () => ({ timer: { id: "t-1", kind: "countdown", durationMs: 60_000, remainingMs: 60_000, running: true, alerted: false } }),
        pause: async () => {},
        resume: async () => {},
        extend: async () => {},
        remove: async () => {},
        dismissRinging: async () => {},
        adopt: async () => [],
      }),
      host.ctx.services.provide(todosV1, {
        list: async () => ({ date: "2026-11-17", todos: [] }),
        days: async () => ({ days: [] }),
        add: async (params) => ({ id: "todo-1", title: params?.title ?? "", completed: false }),
        update: async () => {},
        remove: async () => {},
        note: async () => ({ date: "2026-11-17", note: "" }),
        setNote: async () => {},
      }),
      host.ctx.services.provide(mediaV1, {
        nowPlaying: async () => ({
          available: false,
          playing: false,
          audible: false,
          title: null,
          artist: null,
          album: null,
          sourceApp: null,
          positionMs: 0,
          durationMs: 0,
          canSeek: false,
          canNext: false,
          canPrevious: false,
          updatedAt: Date.now(),
        }),
        playPause: async () => {},
        next: async () => {},
        previous: async () => {},
        seek: async () => {},
      }),
      host.ctx.services.provide(messagesV1, {
        sources: async () => ({ sources: [] }),
        notify: async () => ({ id: "msg-1" }),
        clear: async () => {},
      }),
    );

    await host.settle();
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const current = host.status();
      if (OFFICIAL_PLUGINS.every((slug) => current.find((entry) => entry.id === `@fuyu/${slug}`)?.state === "running")) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    const statuses = host.status();
    for (const slug of OFFICIAL_PLUGINS) {
      const id = `@fuyu/${slug}`;
      const status = statuses.find((entry) => entry.id === id);
      assert.ok(status, `${id} must appear in host.status()`);
      assert.equal(status.state, "running", `${id} expected running, got ${JSON.stringify(status)}`);
      assert.equal(status.source, "market");
      assert.equal(status.undeclared, undefined, `${id} must have no undeclared capabilities: ${JSON.stringify(status.undeclared)}`);
    }

    const initialState = await host.ctx.clients.call("@fuyu/system-monitor", "getState", { locale: "zh-CN" });
    assert.equal(initialState.sampling, true);
    assert.ok(initialState.sample !== null);
    assert.ok(initialState.sample.cpuPercent >= 0 && initialState.sample.cpuPercent <= 100);
    assert.ok(Array.isArray(initialState.sample.cores) && initialState.sample.cores.length > 0);
    assert.ok(initialState.sample.cores.every((pct) => pct >= 0 && pct <= 100));
    assert.ok(initialState.sample.memoryTotalBytes > 0);
    assert.ok(initialState.sample.memoryUsedBytes >= 0 && initialState.sample.memoryUsedBytes <= initialState.sample.memoryTotalBytes);
    assert.ok(initialState.sample.memoryPercent >= 0 && initialState.sample.memoryPercent <= 100);
    assert.ok(initialState.sample.uptimeSec >= 0);
    assert.ok(initialState.sample.hostname.length > 0);
    assert.ok(initialState.sample.arch.length > 0);
    assert.equal(host.timers()["@fuyu/system-monitor"], 1);

    const idleState = await host.ctx.clients.call("@fuyu/system-monitor", "setConfig", {
      showOnBar: false,
      intervalMs: 5000,
    });
    assert.equal(idleState.sampling, false);
    assert.equal(idleState.config.showOnBar, false);
    assert.equal(idleState.config.intervalMs, 5000);
    assert.equal(host.timers()["@fuyu/system-monitor"] ?? 0, 0);

    const watchingState = await host.ctx.clients.call("@fuyu/system-monitor", "watchPage", {
      viewerId: "page-1",
      active: true,
    });
    assert.equal(watchingState.sampling, true);
    assert.equal(host.timers()["@fuyu/system-monitor"], 1);

    const closedState = await host.ctx.clients.call("@fuyu/system-monitor", "watchPage", {
      viewerId: "page-1",
      active: false,
    });
    assert.equal(closedState.sampling, false);
    assert.equal(host.timers()["@fuyu/system-monitor"] ?? 0, 0);

    if (process.platform === "darwin" || process.platform === "win32") {
      const launcherInitial = await host.ctx.clients.call("@fuyu/launcher", "getState");
      assert.deepEqual(
        launcherInitial.apps.map((item) => item.name),
        ["Activity Monitor", "Calculator", "Visual Studio Code"],
      );
      assert.equal(launcherInitial.recentCount, 0);

      const vscodeItem = launcherInitial.apps.find((item) => item.name === "Visual Studio Code");
      const afterLaunch = await host.ctx.clients.call("@fuyu/launcher", "launch", { path: vscodeItem.path });
      assert.equal(afterLaunch.apps[0].name, "Visual Studio Code");
      assert.equal(afterLaunch.apps[0].recent, true);
      assert.equal(afterLaunch.apps[0].count, 1);
      assert.equal(afterLaunch.recentCount, 1);
      const persistedFile = join(hostDir, "data", "@fuyu", "launcher", "launcher.json");
      assert.equal(existsSync(persistedFile), true);
      const persistedJson = JSON.parse(readFileSync(persistedFile, "utf8"));
      assert.equal(persistedJson.usage[vscodeItem.path].count, 1);

      mkdirSync(join(fakeAppsDir, "WeChat.app"), { recursive: true });
      writeFileSync(join(fakeAppsDir, "WeChat.lnk"), "");
      const rescanned = await host.ctx.clients.call("@fuyu/launcher", "rescan");
      assert.equal(rescanned.totalCount, 4);
      assert.equal(rescanned.apps[0].name, "Visual Studio Code");

      const cleared = await host.ctx.clients.call("@fuyu/launcher", "clearRecent");
      assert.equal(cleared.recentCount, 0);
      assert.equal(cleared.apps[0].name, "Activity Monitor");
    }
  } finally {
    for (const provider of providers) {
      await provider.dispose();
    }
    if (host) {
      await host.stop();
    }
    if (prevAppDirs === undefined) delete process.env.FUYU_LAUNCHER_APP_DIRS;
    else process.env.FUYU_LAUNCHER_APP_DIRS = prevAppDirs;
    if (prevDryRun === undefined) delete process.env.FUYU_LAUNCHER_DRY_RUN;
    else process.env.FUYU_LAUNCHER_DRY_RUN = prevDryRun;
  }
});

test("@fuyu/launcher filters substrings and acronyms, ranks recent apps first, and builds detached cross-platform launch specs", () => {
  const sampleApps = [
    { id: "1", name: "Calculator", path: "/apps/Calculator", folder: "" },
    { id: "2", name: "Calendar", path: "/apps/Calendar", folder: "" },
    { id: "3", name: "QuickTime Player", path: "/apps/QuickTime Player", folder: "Media" },
    { id: "4", name: "Visual Studio Code", path: "/apps/Visual Studio Code", folder: "Developer" },
    { id: "5", name: "WeChat", path: "/apps/WeChat", folder: "Social" },
  ];

  let usage = {};
  usage = recordAppLaunch(usage, "/apps/Visual Studio Code", 1000);
  usage = recordAppLaunch(usage, "/apps/Calendar", 2000);
  usage = recordAppLaunch(usage, "/apps/Visual Studio Code", 3000);

  const ranked = rankApps(sampleApps, usage);
  assert.deepEqual(
    ranked.map((item) => item.name),
    ["Visual Studio Code", "Calendar", "Calculator", "QuickTime Player", "WeChat"],
  );
  assert.equal(ranked[0].count, 2);
  assert.equal(ranked[0].recent, true);
  assert.equal(ranked[1].count, 1);
  assert.equal(ranked[2].recent, false);

  assert.deepEqual(filterApps(ranked, "vsc").map((item) => item.name), ["Visual Studio Code"]);
  assert.deepEqual(filterApps(ranked, "WC").map((item) => item.name), ["WeChat"]);
  assert.deepEqual(filterApps(ranked, "qtp").map((item) => item.name), ["QuickTime Player"]);
  assert.deepEqual(filterApps(ranked, "STUDIO").map((item) => item.name), ["Visual Studio Code"]);
  assert.deepEqual(filterApps(ranked, "cal").map((item) => item.name), ["Calendar", "Calculator"]);

  assert.deepEqual(defaultAppRoots("darwin", {}, "/Users/tester"), [
    "/Applications",
    "/System/Applications",
    "/System/Applications/Utilities",
    "/Users/tester/Applications",
  ]);
  assert.deepEqual(
    defaultAppRoots("win32", {
      ProgramData: "C:\\ProgramData",
      APPDATA: "C:\\Users\\tester\\AppData\\Roaming",
    }),
    [
      "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs",
      "C:\\Users\\tester\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs",
    ],
  );

  const scanRoot = join(scratch, "cross-scan");
  mkdirSync(join(scanRoot, "mac", "Utilities", "Terminal.app"), { recursive: true });
  mkdirSync(join(scanRoot, "win", "JetBrains"), { recursive: true });
  writeFileSync(join(scanRoot, "win", "JetBrains", "IntelliJ IDEA.lnk"), "");
  writeFileSync(join(scanRoot, "win", "Docs.url"), "");
  writeFileSync(join(scanRoot, "win", "Uninstall App.lnk"), "");

  const macScanned = scanApplications([join(scanRoot, "mac")], "darwin");
  assert.equal(macScanned.length, 1);
  assert.equal(macScanned[0].name, "Terminal");
  assert.equal(macScanned[0].folder, "Utilities");

  const winScanned = scanApplications([join(scanRoot, "win")], "win32");
  assert.deepEqual(
    winScanned.map((item) => ({ name: item.name, folder: item.folder })),
    [
      { name: "Docs", folder: "" },
      { name: "IntelliJ IDEA", folder: "JetBrains" },
    ],
  );

  assert.deepEqual(buildLaunchSpec("/Applications/Safari.app", "darwin"), {
    command: "open",
    args: ["-a", "/Applications/Safari.app"],
    options: { detached: true, stdio: "ignore" },
  });
  assert.deepEqual(buildLaunchSpec("C:\\Start\\Code.lnk", "win32"), {
    command: "explorer.exe",
    args: ["C:\\Start\\Code.lnk"],
    options: { detached: true, stdio: "ignore", windowsHide: true },
  });
});
