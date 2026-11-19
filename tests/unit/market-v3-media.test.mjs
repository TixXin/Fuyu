import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { MEDIA_DIR } from "../../src/features/updater/host/marketMedia.mjs";
import { createMarketWorld } from "./market-v3-fixtures.mjs";

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const binRes = (buf) => ({ ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
const ICON = "https://market.example/clock.icon.svg";
const SHOT = "https://market.example/clock.page.png";

function mediaWorld(prefix, { served = { [ICON]: SVG, [SHOT]: PNG }, listed = { [ICON]: SVG, [SHOT]: PNG } } = {}) {
  const world = createMarketWorld(prefix);
  const fetched = [];
  for (const [url, buf] of Object.entries(served)) {
    world.routes.set(url, () => {
      fetched.push(url);
      return binRes(buf);
    });
  }
  const entry = world.version({ name: "@someone/clock", version: "1.0.0" });
  entry.icon = { url: ICON, sha256: sha(listed[ICON]) };
  entry.screenshots = [{ url: SHOT, sha256: sha(listed[SHOT]) }];
  world.putIndex(1, [{ name: "@someone/clock", versions: [entry] }]);
  world.putRevoked(1, []);
  return { world, fetched, entry, files: () => (existsSync(join(world.dataDir, MEDIA_DIR)) ? readdirSync(join(world.dataDir, MEDIA_DIR)).sort() : []) };
}

test("media hands back an index-listed image as a data URL and keeps it on disk", async () => {
  const { world, fetched, files } = mediaWorld("fuyu-media-ok-");
  try {
    await world.market.refresh();
    const icon = await world.market.media({ url: ICON });
    const shot = await world.market.media({ url: SHOT });
    assert.equal(icon.data, `data:image/svg+xml;base64,${SVG.toString("base64")}`);
    assert.equal(shot.data, `data:image/png;base64,${PNG.toString("base64")}`);
    assert.deepEqual(files(), [sha(SVG), sha(PNG)].sort());

    world.routes.delete(ICON);
    world.routes.delete(SHOT);
    const before = fetched.length;
    assert.equal((await world.market.media({ url: ICON })).data, icon.data);
    assert.equal(fetched.length, before);
  } finally {
    world.cleanup();
  }
});

test("media refuses a download whose SHA-256 is not the one in the signed index", async () => {
  const { world, files } = mediaWorld("fuyu-media-sha-", { served: { [ICON]: Buffer.from("<svg onload='x'/>"), [SHOT]: PNG } });
  try {
    await world.market.refresh();
    assert.equal((await world.market.media({ url: ICON })).data, null);
    assert.equal((await world.market.media({ url: SHOT })).data !== null, true);
    assert.deepEqual(files(), [sha(PNG)]);
  } finally {
    world.cleanup();
  }
});

test("media only fetches addresses the signed index lists", async () => {
  const { world, fetched } = mediaWorld("fuyu-media-unlisted-");
  const other = "https://market.example/private.png";
  try {
    world.routes.set(other, () => {
      fetched.push(other);
      return binRes(PNG);
    });
    await world.market.refresh();
    assert.deepEqual(await world.market.media({ url: other }), { url: other, data: null });
    assert.equal(fetched.includes(other), false);
    await assert.rejects(() => world.market.media({}), (error) => error.code === "bad-params");
  } finally {
    world.cleanup();
  }
});

test("a refresh drops cached images the new index no longer lists", async () => {
  const { world, entry, files } = mediaWorld("fuyu-media-prune-");
  try {
    await world.market.refresh();
    await world.market.media({ url: ICON });
    await world.market.media({ url: SHOT });
    delete entry.screenshots;
    world.putIndex(2, [{ name: "@someone/clock", versions: [entry] }]);
    await world.market.refresh();
    assert.deepEqual(files(), [sha(SVG)]);
    assert.equal((await world.market.media({ url: SHOT })).data, null);
  } finally {
    world.cleanup();
  }
});
