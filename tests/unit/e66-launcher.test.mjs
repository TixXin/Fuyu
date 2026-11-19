import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { commandsV1 } from "../../packages/plugin-base/src/services.mjs";
import { installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { rankApps, recentApps, recordAppLaunch, sameNameNames, trimUsage } from "../../plugins/v3/official/launcher/src/model.ts";
import { expandHome, scanApplications } from "../../plugins/v3/official/launcher/src/scanner.ts";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../plugins/v3/official/launcher/src/settingsModel.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/launcher", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-launcher-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("E66.5 launcher settings: defaults for new installs, bad values fall back", () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.equal(DEFAULT_SETTINGS.emptyView, "recent");
  assert.equal(DEFAULT_SETTINGS.recentShown, 8);
  assert.equal(DEFAULT_SETTINGS.autoCollapse, true);
  assert.equal(DEFAULT_SETTINGS.showFolder, false);
  assert.equal(DEFAULT_SETTINGS.showCount, false);
  assert.equal(DEFAULT_SETTINGS.recordRecent, true);
  assert.equal(DEFAULT_SETTINGS.historyLimit, 200);

  const odd = normalizeSettings({
    emptyView: "grid",
    recentShown: 7,
    rescanMinutes: 30,
    historyLimit: 999,
    showCount: "yes",
    excluded: [" /a ", "/a", 3, ""],
    extraDirs: "nope",
  });
  assert.equal(odd.emptyView, "recent");
  assert.equal(odd.recentShown, 8);
  assert.equal(odd.rescanMinutes, 30);
  assert.equal(odd.historyLimit, 200);
  assert.equal(odd.showCount, false);
  assert.deepEqual(odd.excluded, ["/a"]);
  assert.deepEqual(odd.extraDirs, []);
  assert.equal(normalizeSettings({ rescanMinutes: 0 }).rescanMinutes, 0);
});

test("E66.5 recent apps: limit, trimming and same-name detection", () => {
  let usage = {};
  for (let i = 0; i < 5; i += 1) usage = recordAppLaunch(usage, `/apps/${i}`, 1000 + i, undefined, 3);
  assert.deepEqual(Object.keys(usage).sort(), ["/apps/2", "/apps/3", "/apps/4"]);
  assert.deepEqual(Object.keys(trimUsage(usage, 2)).sort(), ["/apps/3", "/apps/4"]);

  const apps = [0, 1, 2, 3, 4].map((i) => ({ id: `/apps/${i}`, name: `App ${i}`, path: `/apps/${i}`, folder: "" }));
  const ranked = rankApps(apps, usage);
  assert.deepEqual(recentApps(ranked, 2).map((app) => app.name), ["App 4", "App 3"]);
  assert.deepEqual(recentApps(rankApps(apps, {}), 8), []);

  const dup = sameNameNames([
    { name: "Code", path: "/a/Code", folder: "" },
    { name: "code", path: "/b/Code", folder: "Insiders" },
    { name: "Mail", path: "/a/Mail", folder: "" },
  ]);
  assert.deepEqual([...dup], ["code"]);
});

test("E66.5 scanner keeps same-name apps from different folders and reads extra folders", () => {
  const root = join(scratch, "scan");
  mkdirSync(join(root, "sys", "Code.app"), { recursive: true });
  mkdirSync(join(root, "sys", "Insiders", "Code.app"), { recursive: true });
  mkdirSync(join(root, "user", "Code.app"), { recursive: true });
  mkdirSync(join(root, "extra", "Tool.app"), { recursive: true });

  const mac = scanApplications([join(root, "sys"), join(root, "user")], "darwin", [join(root, "extra")]);
  assert.deepEqual(
    mac.map((app) => [app.name, app.folder]),
    [
      ["Code", ""],
      ["Code", "Insiders"],
      ["Tool", ""],
    ],
  );
  assert.equal(mac[0].path, join(root, "sys", "Code.app"));

  mkdirSync(join(root, "win-start"), { recursive: true });
  mkdirSync(join(root, "win-tools"), { recursive: true });
  writeFileSync(join(root, "win-start", "Notes.lnk"), "");
  writeFileSync(join(root, "win-start", "Portable.exe"), "");
  writeFileSync(join(root, "win-tools", "Portable.exe"), "");
  const win = scanApplications([join(root, "win-start")], "win32", [join(root, "win-tools")]);
  assert.deepEqual(
    win.map((app) => app.path),
    [join(root, "win-start", "Notes.lnk"), join(root, "win-tools", "Portable.exe")],
  );

  assert.equal(expandHome("~/Tools", "/home/u"), join("/home/u", "Tools"));
  assert.equal(expandHome(" /opt/apps ", "/home/u"), "/opt/apps");
});

test(
  "E66.5 launcher host: old data kept, settings apply at once, rescan command works",
  { skip: process.platform !== "darwin" && process.platform !== "win32" },
  async () => {
    const appsDir = join(scratch, "apps");
    const extraDir = join(scratch, "extra-apps");
    mkdirSync(appsDir, { recursive: true });
    mkdirSync(extraDir, { recursive: true });
    const make = (dir, name) => {
      if (process.platform === "darwin") mkdirSync(join(dir, `${name}.app`), { recursive: true });
      else writeFileSync(join(dir, `${name}.lnk`), "");
      return join(dir, `${name}${process.platform === "darwin" ? ".app" : ".lnk"}`);
    };
    const notes = make(appsDir, "Notes");
    const mail = make(appsDir, "Mail");

    const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, "built"), packDir: join(scratch, "packed") });
    assert.equal(packed.manifest.version, "1.1.0");
    assert.deepEqual(packed.manifest.fuyu.commands.map((item) => item.id), ["open", "rescan"]);
    assert.equal(packed.manifest.fuyu.displayName.en, "App launcher");
    const hostDir = join(scratch, "host");
    mkdirSync(hostDir, { recursive: true });
    installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });

    const dataDir = join(hostDir, "data", "@fuyu", "launcher");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "launcher.json"), JSON.stringify({ usage: { [mail]: { count: 3, lastLaunchedAt: 5000 } } }));

    const prevDirs = process.env.FUYU_LAUNCHER_APP_DIRS;
    const prevDry = process.env.FUYU_LAUNCHER_DRY_RUN;
    process.env.FUYU_LAUNCHER_APP_DIRS = appsDir;
    process.env.FUYU_LAUNCHER_DRY_RUN = "1";
    const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
    try {
      await host.settle();
      assert.equal(host.status().find((item) => item.id === "@fuyu/launcher")?.state, "running");
      const call = (method, params) => host.ctx.clients.call("@fuyu/launcher", method, params);

      const initial = await call("getState");
      assert.deepEqual(initial.settings, DEFAULT_SETTINGS);
      assert.deepEqual(initial.apps.map((app) => app.name), ["Mail", "Notes"]);
      assert.equal(initial.apps[0].count, 3);

      const hidden = await call("setSettings", { excluded: [notes], historyLimit: 20 });
      assert.deepEqual(hidden.apps.map((app) => app.name), ["Mail"]);
      assert.deepEqual(hidden.excludedApps, [{ path: notes, name: "Notes" }]);

      const quiet = await call("setSettings", { recordRecent: false });
      assert.equal(quiet.recentCount, 0);
      await call("launch", { path: mail });
      const saved = JSON.parse(readFileSync(join(dataDir, "launcher.json"), "utf8"));
      assert.equal(saved.usage[mail].count, 3, "launches are not recorded while history is off");
      assert.equal(saved.settings.historyLimit, 20);
      assert.deepEqual(saved.settings.excluded, [notes]);

      await assert.rejects(call("addExtraDir", { dir: join(scratch, "nowhere") }), /missing-dir/);
      const tool = make(extraDir, "Tool");
      const withExtra = await call("addExtraDir", { dir: extraDir });
      assert.ok(withExtra.apps.some((app) => app.path === tool));

      let commands;
      await host.ctx.plugin({
        name: "e66-launcher-inspector",
        apply(ctx) {
          commands = ctx.services.get(commandsV1);
        },
      });
      const own = (await commands.list()).items.filter((item) => item.pluginId === "@fuyu/launcher");
      assert.deepEqual(own.map((item) => item.id), ["open", "rescan"]);
      assert.equal(host.status().find((item) => item.id === "@fuyu/launcher")?.state, "running");
      await assert.rejects(commands.run({ plugin: "@fuyu/launcher", command: "open" }), (error) => {
        assert.match(String(error?.code ?? error?.message), /not-ready/);
        return true;
      });
      make(appsDir, "Calendar");
      const rescanned = await commands.run({ plugin: "@fuyu/launcher", command: "rescan" });
      assert.ok(rescanned.apps.some((app) => app.name === "Calendar"));
    } finally {
      await host.stop();
      if (prevDirs === undefined) delete process.env.FUYU_LAUNCHER_APP_DIRS;
      else process.env.FUYU_LAUNCHER_APP_DIRS = prevDirs;
      if (prevDry === undefined) delete process.env.FUYU_LAUNCHER_DRY_RUN;
      else process.env.FUYU_LAUNCHER_DRY_RUN = prevDry;
    }
  },
);
