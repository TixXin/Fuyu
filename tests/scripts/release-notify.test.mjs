import assert from "node:assert/strict";
import { test } from "node:test";
import { barkConfig, barkPayload, createNotifier } from "../../scripts/release/notify.mjs";
import { siteDown } from "../../scripts/release/site-import.mjs";
import { createClock } from "../../scripts/release/timing.mjs";

const fileWith = (json) => ({ path: "/x/bark.json", exists: () => json !== undefined, read: () => json });

test("Bark settings come from the env first, then the local file, and need an https endpoint and a key", () => {
  const file = fileWith(JSON.stringify({ endpoint: "https://bark.example.org/", deviceKeys: ["a", "a", " b "] }));
  assert.deepEqual(barkConfig({}, file), { endpoint: "https://bark.example.org", deviceKeys: ["a", "b"] });
  assert.deepEqual(barkConfig({ FUYU_BARK_ENDPOINT: "https://env.example.org", FUYU_BARK_KEYS: "k1,k2" }, file), { endpoint: "https://env.example.org", deviceKeys: ["k1", "k2"] });
  assert.equal(barkConfig({ FUYU_BARK: "0" }, file), null);
  assert.equal(barkConfig({}, fileWith(undefined)), null);
  assert.equal(barkConfig({}, fileWith("not json")), null);
  assert.equal(barkConfig({}, fileWith(JSON.stringify({ endpoint: "http://plain.example.org", deviceKeys: ["a"] }))), null);
  assert.equal(barkConfig({}, fileWith(JSON.stringify({ endpoint: "https://bark.example.org", deviceKeys: [] }))), null);
});

test("a long or coloured step line is cleaned and cut to fit a notice", () => {
  const payload = barkPayload("k", "t", `\x1b[32m${"x".repeat(400)}\x1b[39m`, { level: "timeSensitive" });
  assert.equal(payload.body.length, 320);
  assert.ok(payload.body.endsWith("…") && !payload.body.includes("\x1b"));
  assert.equal(payload.level, "timeSensitive");
  assert.equal(barkPayload("k", "t", "ok").level, undefined);
});

test("every device gets each notice, and a dead Bark warns once without stopping the release", (t) => {
  const posts = [];
  const notifier = createNotifier({ config: { endpoint: "https://b.example.org", deviceKeys: ["k1", "k2"] }, prefix: "Fuyu v1 · ", post: (url, json) => posts.push({ url, ...JSON.parse(json) }) > 0 });
  assert.equal(notifier.step("✓ [+0:04] ready"), true);
  assert.deepEqual(posts.map(({ url, device_key, title }) => [url, device_key, title]), [["https://b.example.org/push", "k1", "Fuyu v1 · 进度"], ["https://b.example.org/push", "k2", "Fuyu v1 · 进度"]]);
  const warnings = [];
  t.mock.method(console, "error", (line) => warnings.push(line));
  const dead = createNotifier({ config: { endpoint: "https://b.example.org", deviceKeys: ["k"] }, post: () => false });
  assert.equal(dead.problem("boom"), false);
  assert.equal(dead.finished("done"), false);
  assert.equal(warnings.length, 1);
  assert.equal(createNotifier({ config: null, post: () => assert.fail("no Bark, no post") }).step("x"), false);
});

test("each finished release stage reaches the listeners with the same line the log shows", () => {
  let now = 0;
  const logged = [];
  const heard = [];
  const clock = createClock({ now: () => now, log: (line) => logged.push(line) });
  clock.listen((line) => heard.push(line));
  now = 65_000;
  clock.done("upload", "Uploaded.");
  clock.mark("quiet");
  assert.deepEqual(heard, ["✓ [+1:05] Uploaded."]);
  assert.deepEqual(logged, heard);
});

test("the site check warns when the update API is down or unreachable, and stays quiet when it answers", async () => {
  assert.equal(await siteDown(async () => ({ ok: true, status: 200 })), null);
  assert.match(await siteDown(async () => ({ ok: false, status: 404 })), /answers 404.*--no-site/);
  assert.match(await siteDown(async () => { throw new Error("ECONNREFUSED"); }), /cannot be read \(ECONNREFUSED\)/);
});
