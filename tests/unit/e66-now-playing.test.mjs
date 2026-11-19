import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { startHost } from "../../packages/plugin-base/src/host/kernel.mjs";
import { check, installPackage, pack } from "../../packages/plugin-cli/src/index.mjs";
import { mediaV1, messagesV1 } from "../../packages/plugin-services/src/index.mjs";
import {
  DEFAULT_CONFIG,
  MUSIC_ICON_URL,
  appAllowed,
  isBrowser,
  appLabel,
  isHeard,
  pollDelay,
  buildNotice,
  normalizeConfig,
  readStoredConfig,
  rememberApp,
} from "../../plugins/v3/official/now-playing/src/model.ts";

const PLUGIN_DIR = fileURLToPath(new URL("../../plugins/v3/official/now-playing", import.meta.url));
const ID = "@fuyu/now-playing";
const scratch = mkdtempSync(join(tmpdir(), "fuyu-e66-now-playing-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const HOST_HAS_CHANGED = Object.hasOwn(mediaV1.events, "changed");

const track = (title, artist, extra = {}) => ({
  available: true,
  playing: true,
  audible: true,
  title,
  artist,
  album: "Album",
  sourceApp: "com.spotify.client",
  positionMs: 0,
  durationMs: 200_000,
  canSeek: true,
  canNext: true,
  canPrevious: true,
  updatedAt: Date.now(),
  ...extra,
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, ms = 2000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await wait(25);
  }
  return check();
}

test("track change notice config: new installs notify, a saved off stays off, junk falls back", () => {
  assert.equal(readStoredConfig(null).autoNotify, true);
  assert.equal(DEFAULT_CONFIG.durationSec, 3);
  assert.equal(DEFAULT_CONFIG.skipFrontmost, true);
  assert.equal(DEFAULT_CONFIG.browsers, false);
  assert.equal(DEFAULT_CONFIG.content, "title-artist");
  assert.equal(DEFAULT_CONFIG.showControls, true);
  assert.equal(DEFAULT_CONFIG.lastOnly, true);
  assert.equal(DEFAULT_CONFIG.appMode, "all");

  const old = readStoredConfig({ autoNotify: false, locale: "zh-CN" });
  assert.equal(old.autoNotify, false);
  assert.equal(old.durationSec, 3);
  assert.equal("locale" in old, false);
  assert.equal(readStoredConfig({ locale: "en" }).autoNotify, true);

  const patched = normalizeConfig({ durationSec: 7, content: "lyrics", appMode: "some", apps: ["a", "a", 3, " b "] }, old);
  assert.equal(patched.durationSec, 3);
  assert.equal(patched.content, "title-artist");
  assert.deepEqual(patched.apps, ["a", "b"]);
  assert.equal(patched.autoNotify, false);
});

test("track change notice config: the old default of 6 seconds becomes 3 once, a chosen length is kept", () => {
  assert.equal(readStoredConfig({ autoNotify: true, durationSec: 6 }).durationSec, 3);
  assert.equal(readStoredConfig({ autoNotify: true, durationSec: 10 }).durationSec, 10);
  assert.equal(readStoredConfig({ autoNotify: true, durationSec: 15, version: 1 }).durationSec, 15);
  const migrated = readStoredConfig({ autoNotify: true, durationSec: 6 });
  assert.equal(migrated.version, 2);
  assert.equal(readStoredConfig({ ...migrated, durationSec: 6 }).durationSec, 6);
  assert.equal(readStoredConfig(JSON.parse(JSON.stringify(migrated))).durationSec, 3);
});

test("track change notice apps: browsers are left out unless switched on or ticked", () => {
  for (const app of ["chrome.exe", "MSEdge", "com.google.Chrome", "com.apple.Safari", "org.mozilla.firefox", "company.thebrowser.Browser", "308046B0AF4A39CB", "Google Chrome"]) {
    assert.equal(isBrowser(app), true, app);
    assert.equal(appAllowed(app, DEFAULT_CONFIG), false, app);
    assert.equal(appAllowed(app, { ...DEFAULT_CONFIG, browsers: true }), true, app);
  }
  for (const app of ["Spotify.exe", "com.soda.music", "汽水音乐", "cloudmusic.exe", "com.apple.Music", "QQMusic.exe", "Searcher.exe", null]) {
    assert.equal(isBrowser(app), false, String(app));
    assert.equal(appAllowed(app, DEFAULT_CONFIG), true, String(app));
  }
  assert.equal(appAllowed("chrome.exe", { ...DEFAULT_CONFIG, appMode: "some", apps: ["chrome.exe"] }), true);
});

test("track change notice content, apps and icon", () => {
  const song = track("Song", "Singer");
  assert.deepEqual(buildNotice(song, DEFAULT_CONFIG), {
    title: "Song",
    body: "Singer",
    durationMs: 3000,
    iconUrl: MUSIC_ICON_URL,
    layout: "inline",
    controls: "media",
  });
  assert.equal(buildNotice(song, { ...DEFAULT_CONFIG, content: "title" }).body, "");
  assert.equal(buildNotice(song, { ...DEFAULT_CONFIG, content: "title-artist-album" }).body, "Singer · Album");
  assert.equal(buildNotice(song, { ...DEFAULT_CONFIG, showControls: false, durationSec: 10 }).controls, "none");
  assert.equal(buildNotice(track("  ", "x"), DEFAULT_CONFIG), null);
  assert.ok(MUSIC_ICON_URL.startsWith("data:image/svg+xml"));

  const some = { ...DEFAULT_CONFIG, appMode: "some", apps: ["Spotify.exe"] };
  assert.equal(appAllowed("Spotify.exe", some), true);
  assert.equal(appAllowed("Music", some), false);
  assert.equal(appAllowed(null, DEFAULT_CONFIG), true);
  assert.deepEqual(rememberApp(DEFAULT_CONFIG, "Spotify.exe").seenApps, ["Spotify.exe"]);
  assert.equal(rememberApp({ ...DEFAULT_CONFIG, seenApps: ["Spotify.exe"] }, "Spotify.exe"), null);

  assert.equal(appLabel("Spotify.exe"), "Spotify");
  assert.equal(appLabel("com.apple.Music"), "Apple Music");
  assert.equal(appLabel("com.apple.Podcasts"), "Podcasts");
  assert.equal(appLabel("com.soda.music", "zh-CN"), "汽水音乐");
  assert.equal(appLabel("com.soda.music", "en"), "Soda Music");
  assert.equal(appLabel("com.netease.163music", "zh-CN"), "网易云音乐");
  assert.equal(appLabel("cloudmusic.exe"), "NetEase Cloud Music");
  assert.equal(appLabel("com.tencent.QQMusicMac", "zh-CN"), "QQ音乐");
  assert.equal(appLabel("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App"), "Apple Music");
  assert.equal(appLabel("Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic"), "ZuneMusic");
  assert.equal(appLabel("QQ音乐"), "QQ音乐");

  assert.equal(isHeard({ playing: true }, 0, 100_000), true);
  assert.equal(isHeard({ playing: false }, 95_000, 100_000), true);
  assert.equal(isHeard({ playing: false }, 80_000, 100_000), false);

  assert.equal(pollDelay(false, false), 2500);
  assert.equal(pollDelay(false, true), 15_000);
  assert.equal(pollDelay(true, true), 30_000);
});

async function startWithPlugin(name, { config, emits }) {
  const result = await check(PLUGIN_DIR, { official: true, allowExperimental: false });
  assert.deepEqual(result.errors, []);
  const packed = await pack(PLUGIN_DIR, { official: true, allowExperimental: false, outDir: join(scratch, `${name}-built`), packDir: join(scratch, `${name}-packed`) });
  assert.equal(packed.manifest.version, "1.2.0");
  assert.equal(packed.manifest.fuyu.displayName.en, "Track change notice");

  const hostDir = join(scratch, name);
  mkdirSync(hostDir, { recursive: true });
  installPackage(packed.file, { dir: hostDir, source: "market", official: true, expectedSha256: packed.sha256 });
  if (config) {
    const dataDir = join(hostDir, "data", "@fuyu", "now-playing");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "config.json"), JSON.stringify(config));
  }

  const state = { now: track("First", "A"), notices: [] };
  const host = await startHost({ dir: hostDir, appVersion: "0.4.0" });
  const media = host.ctx.services.provide(mediaV1, {
    nowPlaying: async () => state.now,
    playPause: async () => state.now,
    next: async () => state.now,
    previous: async () => state.now,
    seek: async () => state.now,
  });
  const messages = host.ctx.services.provide(messagesV1, {
    sources: async () => ({ sources: [] }),
    notify: async (notice) => {
      state.notices.push(notice);
      return { shown: true, receivedAt: Date.now() };
    },
    clear: async () => ({ ok: true }),
  });
  await host.settle();
  await until(() => host.status().find((entry) => entry.id === ID)?.state === "running");
  const call = (method, params) => host.ctx.clients.call(ID, method, params);
  const change = (next) => {
    state.now = next;
    if (emits && HOST_HAS_CHANGED) media.emit("changed", next);
  };
  const stop = async () => {
    await media.dispose();
    await messages.dispose();
    await host.stop();
  };
  return { host, hostDir, state, call, change, stop };
}

test("track change notice host: events drive notices, pause is not a change, quick skips show the last one", { skip: !HOST_HAS_CHANGED && "media/v1 does not declare changed yet" }, async () => {
  const run = await startWithPlugin("events", { emits: true });
  try {
    const first = await run.call("getState");
    assert.equal(first.config.autoNotify, true);
    await wait(100);
    assert.equal(run.state.notices.length, 0);

    run.change(track("Second", "B"));
    run.change(track("Third", "C"));
    assert.ok(await until(() => run.state.notices.length === 1, 3000));
    await wait(300);
    assert.equal(run.state.notices.length, 1);
    const [notice] = run.state.notices;
    assert.equal(notice.title, "Third");
    assert.equal(notice.body, "C");
    assert.equal(notice.iconUrl, MUSIC_ICON_URL);
    assert.equal(notice.controls, "media");
    assert.equal(notice.source, ID);

    run.change(track("Third", "C", { playing: false }));
    run.change(track("Third", "C"));
    await wait(1600);
    assert.equal(run.state.notices.length, 1);

    run.change(track("Paused new", "D", { playing: false }));
    await wait(1600);
    assert.equal(run.state.notices.length, 1);

    run.change(track(null, null, { sourceApp: "汽水音乐" }));
    run.change(track("Mac song", "G", { playing: false, sourceApp: "com.soda.music" }));
    assert.ok(await until(() => run.state.notices.length === 2, 3000));
    assert.equal(run.state.notices[1].title, "Mac song");

    await run.call("setConfig", { lastOnly: false, content: "title", showControls: false });
    run.change(track("Fourth", "E"));
    assert.ok(await until(() => run.state.notices.length === 3));
    assert.equal(run.state.notices[2].body, "");
    assert.equal(run.state.notices[2].controls, "none");

    await run.call("setConfig", { appMode: "some", apps: ["Spotify.exe"] });
    run.change(track("Fifth", "F"));
    await wait(300);
    assert.equal(run.state.notices.length, 3);

    const shown = await run.call("showNow");
    assert.equal(run.state.notices.length, 4);
    assert.equal(typeof shown.note, "string");

    const saved = JSON.parse(readFileSync(join(run.hostDir, "data", "@fuyu", "now-playing", "config.json"), "utf8"));
    assert.equal(saved.lastOnly, false);
    assert.deepEqual(saved.apps, ["Spotify.exe"]);
    assert.deepEqual(saved.seenApps, ["com.soda.music", "汽水音乐", "com.spotify.client"]);
  } finally {
    await run.stop();
  }
});

test("track change notice host: a saved off stays off; polling notifies, skips pauses and filters apps", async () => {
  const run = await startWithPlugin("poll", { config: { autoNotify: false, locale: "zh-CN" }, emits: false });
  try {
    const first = await run.call("getState");
    assert.equal(first.config.autoNotify, false);
    assert.equal(first.config.durationSec, 3);
    run.change(track("Second", "B"));
    await wait(300);
    assert.equal(run.state.notices.length, 0);

    await run.call("setConfig", { autoNotify: true });
    run.change(track("Third", "C"));
    assert.ok(await until(() => run.state.notices.length === 1, 6000));
    const [notice] = run.state.notices;
    assert.deepEqual([notice.title, notice.body, notice.controls, notice.layout, notice.source], ["Third", "C", "media", "inline", ID]);
    assert.equal(notice.iconUrl, MUSIC_ICON_URL);

    run.change(track("Paused new", "D", { playing: false }));
    await wait(3000);
    assert.equal(run.state.notices.length, 1);

    run.change(track("In front", "E", { sourceFrontmost: true }));
    await wait(3000);
    assert.equal(run.state.notices.length, 1);
    run.change(track("In a browser", "E", { sourceApp: "com.google.Chrome" }));
    await wait(3000);
    assert.equal(run.state.notices.length, 1);
    await run.call("setConfig", { skipFrontmost: false, browsers: true });
    run.change(track("In front again", "E", { sourceFrontmost: true }));
    assert.ok(await until(() => run.state.notices.length === 2, 6000));
    run.change(track("In a browser again", "E", { sourceApp: "com.google.Chrome" }));
    assert.ok(await until(() => run.state.notices.length === 3, 6000));
    await run.call("setConfig", { skipFrontmost: true, browsers: false });

    await run.call("setConfig", { appMode: "some", apps: ["Spotify.exe"] });
    run.change(track("Fifth", "F"));
    await wait(3000);
    assert.equal(run.state.notices.length, 3);

    const shown = await run.call("showNow");
    assert.equal(run.state.notices.length, 4);
    assert.equal(typeof shown.note, "string");

    const saved = JSON.parse(readFileSync(join(run.hostDir, "data", "@fuyu", "now-playing", "config.json"), "utf8"));
    assert.equal(saved.autoNotify, true);
    assert.deepEqual(saved.apps, ["Spotify.exe"]);
    assert.deepEqual(saved.seenApps, ["com.google.Chrome", "com.spotify.client"]);
    assert.equal(saved.version, 2);
  } finally {
    await run.stop();
  }
});

test("track change notice host: an untitled reading from changed is read again 1.5 s later", { skip: !HOST_HAS_CHANGED && "media/v1 does not declare changed yet" }, async () => {
  const run = await startWithPlugin("reread", { emits: true });
  try {
    await run.call("getState");
    run.change(track(null, null, { sourceApp: "汽水音乐" }));
    run.state.now = track("Arrived late", "H");
    assert.ok(await until(() => run.state.notices.length === 1, 4000));
    assert.equal(run.state.notices[0].title, "Arrived late");
  } finally {
    await run.stop();
  }
});
