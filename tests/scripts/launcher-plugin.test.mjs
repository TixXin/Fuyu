import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { startMockHost } from "../../packages/fuyu-plugin/src/test/index.mjs";
import { appFolders, findApps, folderLabel, launchCommand, noteLaunch, recentApps } from "../../plugins/drafts/dev.focusd.launcher/apps.mjs";

const PLUGIN = path.resolve("plugins/drafts/dev.focusd.launcher");

function fakeApps(extension) {
  const root = mkdtempSync(path.join(os.tmpdir(), "fuyu-launcher-"));
  const make = (relative) => {
    const full = path.join(root, relative);
    if (extension === ".app") mkdirSync(full, { recursive: true });
    else {
      mkdirSync(path.dirname(full), { recursive: true });
      writeFileSync(full, "");
    }
  };
  for (const name of ["Zed", "Calculator", "Tools/Terminal", "Tools/Uninstall Zed", "Tools/Deep/Deeper/Too Deep", ".Hidden"]) make(`${name}${extension}`);
  writeFileSync(path.join(root, "notes.txt"), "");
  return root;
}

test("apps are found by extension, sorted, without uninstallers or duplicates", () => {
  for (const extension of [".app", ".lnk"]) {
    const root = fakeApps(extension);
    const second = fakeApps(extension);
    try {
      const apps = findApps([root, second, path.join(root, "missing")], extension);
      assert.deepEqual(apps.map((app) => app.name), ["Calculator", "Terminal", "Zed"], extension);
      assert.equal(apps[1].path, path.join(root, "Tools", `Terminal${extension}`));
      assert.equal(folderLabel(apps[1].path, [root]), "Tools");
      assert.equal(folderLabel(apps[0].path, [root]), "");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  }
});

test("each system has its folders and its way to open an app", () => {
  assert.deepEqual(appFolders("darwin", {}, "/Users/me"), ["/Applications", "/System/Applications", path.join("/Users/me", "Applications")]);
  const windows = appFolders("win32", { APPDATA: "C:\\Users\\me\\AppData\\Roaming", ProgramData: "C:\\ProgramData" }, "C:\\Users\\me");
  assert.equal(windows.length, 2);
  assert.ok(windows.every((folder) => folder.includes("Start Menu")));
  assert.deepEqual(appFolders("linux", {}, "/home/me"), []);
  assert.deepEqual(appFolders("darwin", { FUYU_LAUNCHER_APP_DIRS: ["/a", "/b"].join(path.delimiter) }, "/Users/me"), ["/a", "/b"]);
  assert.deepEqual(launchCommand("/Applications/Zed.app", "darwin"), ["/usr/bin/open", ["/Applications/Zed.app"]]);
  assert.deepEqual(launchCommand("C:\\x\\Zed.lnk", "win32"), ["explorer.exe", ["C:\\x\\Zed.lnk"]]);
  assert.equal(launchCommand("/x", "linux"), null);
});

test("recent apps are the last opened ones, and apps that are gone are forgotten", () => {
  const apps = [{ name: "A", path: "/a" }, { name: "B", path: "/b" }, { name: "C", path: "/c" }];
  let usage = noteLaunch({ "/gone": { count: 3, last: 1 } }, "/a", 10, new Set(["/a", "/b", "/c"]));
  usage = noteLaunch(usage, "/c", 20, new Set(["/a", "/b", "/c"]));
  usage = noteLaunch(usage, "/a", 30, new Set(["/a", "/b", "/c"]));
  assert.deepEqual(usage, { "/a": { count: 2, last: 30 }, "/c": { count: 1, last: 20 } });
  assert.deepEqual(recentApps(apps, usage, 6).map((app) => app.name), ["A", "C"]);
  assert.deepEqual(recentApps(apps, usage, 1).map((app) => app.name), ["A"]);
  assert.deepEqual(recentApps(apps, usage, 0), []);
});

test("the launcher lists apps, opens its page on the shortcut and remembers what was opened", async () => {
  const extension = process.platform === "win32" ? ".lnk" : ".app";
  const root = fakeApps(extension);
  const before = { dirs: process.env.FUYU_LAUNCHER_APP_DIRS, dry: process.env.FUYU_LAUNCHER_DRY_RUN };
  process.env.FUYU_LAUNCHER_APP_DIRS = root;
  process.env.FUYU_LAUNCHER_DRY_RUN = "1";
  const host = startMockHost(PLUGIN);
  try {
    host.command("open");
    await host.waitFor((state) => state.openedViews.includes("apps"));
    host.viewVisible("apps");
    const model = await host.waitForView("apps", (next) => next.groups?.length === 1);
    assert.equal(model.search.mode, "local");
    assert.deepEqual(model.groups[0].items.map((item) => item.title), ["Calculator", "Terminal", "Zed"]);
    assert.equal(model.groups[0].items[1].subtitle, "Tools");

    const zed = model.groups[0].items[2];
    host.viewAction("apps", "launch", { itemId: zed.id });
    await host.waitForLog(/would open .*Zed/);
    const withRecent = await host.waitForView("apps", (next) => next.groups?.length === 2);
    assert.deepEqual(withRecent.groups[0].items.map((item) => item.title), ["Zed"]);
    assert.equal(Object.keys(host.storage.get("usage")).length, 1);

    host.viewAction("apps", "launch", { itemId: withRecent.groups[0].items[0].id });
    await host.waitFor((state) => Object.values(state.storage.get("usage"))[0].count === 2);

    host.changeSettings({ recentCount: 0 });
    await host.waitForView("apps", (next) => next.groups?.length === 1);
  } finally {
    await host.stop();
    rmSync(root, { recursive: true, force: true });
    for (const [key, value] of [["FUYU_LAUNCHER_APP_DIRS", before.dirs], ["FUYU_LAUNCHER_DRY_RUN", before.dry]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("an empty computer shows the empty state", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fuyu-launcher-empty-"));
  const before = process.env.FUYU_LAUNCHER_APP_DIRS;
  process.env.FUYU_LAUNCHER_APP_DIRS = root;
  const host = startMockHost(PLUGIN);
  try {
    host.viewVisible("apps");
    const model = await host.waitForView("apps");
    assert.deepEqual(model.groups, []);
    assert.equal(model.empty.en, "No apps found");
  } finally {
    await host.stop();
    rmSync(root, { recursive: true, force: true });
    if (before === undefined) delete process.env.FUYU_LAUNCHER_APP_DIRS;
    else process.env.FUYU_LAUNCHER_APP_DIRS = before;
  }
});
