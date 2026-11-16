import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { startHost } from "@fuyu/plugin-base/host";
import { mediaV1 } from "@fuyu/plugin-services";
import { connect } from "../../packages/plugin-base/src/host/rpc.mjs";
import { fromRust, positionOf, serviceNowPlaying } from "../../src/features/media/host/index.mjs";

const BUILTINS = fileURLToPath(new URL("../../src/features/", import.meta.url));

const cleanup = [];
after(async () => {
  for (const step of cleanup.reverse()) await step();
});

function fakeRust(methods) {
  const toHost = new PassThrough();
  const fromHost = new PassThrough();
  const seen = [];
  const write = (message) => toHost.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  createInterface({ input: fromHost }).on("line", async (line) => {
    const message = JSON.parse(line);
    seen.push(message);
    if (message.id === undefined) return;
    const method = methods[message.method];
    if (!method) return write({ id: message.id, error: { code: "no-method", message: `Rust has no method ${message.method}` } });
    try {
      write({ id: message.id, result: await method(message.params) });
    } catch (error) {
      write({ id: message.id, error: { code: error.code, message: error.message, ...(error.data ? { data: error.data } : {}) } });
    }
  });
  const rpc = connect({ input: toHost, write: (text) => fromHost.write(text) });
  return { rpc, asked: (method) => seen.filter((message) => message.method === method).map((message) => message.params) };
}

async function open(methods) {
  const dir = mkdtempSync(join(tmpdir(), "media-host-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "plugins.yml"), "[]\n");
  const rust = fakeRust(methods);
  const host = await startHost({ dir, builtins: BUILTINS, rpc: rust.rpc });
  cleanup.push(() => host.stop());
  await host.settle();
  let media;
  await host.ctx.plugin({ name: "asker", apply: (ctx) => void (media = ctx.services.get(mediaV1)) });
  return { host, rust, media };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check, ms = 5000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (check()) return true;
    await sleep(10);
  }
  return check();
}

const PLAYING = {
  available: true,
  playing: true,
  audible: true,
  title: "Song",
  artist: "Singer",
  album: null,
  sourceApp: "Spotify.exe",
  positionMs: 42_000,
  durationMs: 214_000,
  canSeek: true,
  canNext: true,
  canPrevious: true,
  updatedAt: 10,
};

test("the music plugin provides media/v1 and drives the player through Rust", async () => {
  const { host, rust, media } = await open({
    "media.nowPlaying": () => PLAYING,
    "media.playPause": () => ({ ...PLAYING, playing: false }),
    "media.next": () => ({ ...PLAYING, title: "Next" }),
    "media.previous": () => ({ ...PLAYING, title: "Before" }),
    "media.seek": ({ positionMs }) => ({ ...PLAYING, positionMs }),
  });
  assert.equal(host.status().find((plugin) => plugin.id === "music").state, "running");
  assert.deepEqual(await media.nowPlaying(), PLAYING);
  assert.equal((await media.playPause()).playing, false);
  assert.equal((await media.next()).title, "Next");
  assert.equal((await media.previous()).title, "Before");
  assert.equal((await media.seek({ positionMs: 5000 })).positionMs, 5000);
  assert.deepEqual(rust.asked("media.seek"), [{ positionMs: 5000 }]);
  await assert.rejects(media.seek({ positionMs: -1 }), { code: "bad-params" });
  await assert.rejects(media.seek({ positionMs: 1.5 }), { code: "bad-params" });
  await assert.rejects(media.seek({ positionMs: 1, target: "x" }), { code: "bad-params" });
  assert.equal(rust.asked("media.seek").length, 1);
});

test("a switched-off player is peer-gone, and a stopped music plugin is not-ready", async () => {
  const { host, media } = await open({
    "media.nowPlaying": () => {
      throw Object.assign(new Error("The music plugin is switched off."), { code: "inactive" });
    },
  });
  await assert.rejects(media.nowPlaying(), (error) => error.code === "peer-gone" && error.data.reason === "inactive");
  [...host.ctx.loader.entries()].find((candidate) => candidate.options.id === "music").update({ disabled: true });
  assert.ok(await until(() => !host.services().some((service) => service.name === "media/v1")));
  await assert.rejects(media.nowPlaying(), { code: "not-ready" });
});

test("the window's media state and the host's answer turn into the same shape", () => {
  const windowState = {
    available: true,
    audioActive: true,
    audioPeak: 0.4,
    playbackStatus: "playing",
    title: "Song",
    artist: "Singer",
    album: "",
    thumbnail: "data:image/png;base64,AA",
    positionMs: 42_000,
    durationMs: 214_000,
    canSeek: true,
    canNext: true,
    canPrevious: true,
    shuffleActive: null,
    canShuffle: false,
    repeatMode: "unknown",
    canRepeat: false,
    volume: 0.5,
    sourceApp: "Spotify.exe",
    activeSessionId: "Spotify.exe",
    sessions: [],
    updatedAt: 10,
  };
  assert.deepEqual(serviceNowPlaying(windowState), PLAYING);
  assert.deepEqual(serviceNowPlaying({ ...PLAYING, extra: 1 }), PLAYING);
  assert.deepEqual(serviceNowPlaying(null), { ...PLAYING, available: false, playing: false, audible: false, title: null, artist: null, sourceApp: null, positionMs: 0, durationMs: 0, canSeek: false, canNext: false, canPrevious: false, updatedAt: 0 });
  assert.equal(positionOf({ positionMs: 0 }), 0);
  assert.throws(() => positionOf(undefined), { code: "bad-params" });
  assert.throws(() => positionOf({ positionMs: "10" }), { code: "bad-params" });
  assert.equal(fromRust({ code: "timeout", message: "late" }).code, "timeout");
  assert.equal(fromRust({ code: "inactive", message: "gone" }).code, "peer-gone");
  assert.equal(fromRust("plain").data.reason, "failed");
});
