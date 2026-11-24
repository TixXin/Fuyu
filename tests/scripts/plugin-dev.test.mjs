import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { detectDevPluginsDir, resolvePluginDir, restoreMarketEntry } from "../../scripts/plugins-v3/dev-official.mjs";

const scratch = mkdtempSync(join(tmpdir(), "fuyu-plugin-dev-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("resolvePluginDir resolves official slugs, @fuyu ids, and explicit plugin paths", () => {
  const bySlug = resolvePluginDir("weather");
  assert.equal(bySlug.official, true);
  assert.equal(bySlug.slug, "weather");
  assert.ok(bySlug.dir.endsWith(join("plugins", "v3", "official", "weather")));

  const byId = resolvePluginDir("@fuyu/weather");
  assert.equal(byId.dir, bySlug.dir);
  assert.equal(byId.official, true);

  const byPath = resolvePluginDir(bySlug.dir);
  assert.equal(byPath.dir, bySlug.dir);
  assert.equal(byPath.official, true);

  assert.throws(() => resolvePluginDir("definitely-not-a-plugin"), /plugin not found/);
});

test("detectDevPluginsDir picks the most recently updated lane and honors explicit overrides", () => {
  const home = join(scratch, "home");
  const lane1 = join(home, "Library", "Application Support", "com.tixxin.fuyu.lane-1", "plugins-v3");
  const lane2 = join(home, "Library", "Application Support", "com.tixxin.fuyu.lane-2", "plugins-v3");
  mkdirSync(lane1, { recursive: true });
  mkdirSync(lane2, { recursive: true });
  const yml1 = join(lane1, "plugins.yml");
  const yml2 = join(lane2, "plugins.yml");
  writeFileSync(yml1, "[]\n");
  writeFileSync(yml2, "[]\n");
  utimesSync(yml1, new Date(1000), new Date(1000));
  utimesSync(yml2, new Date(2000), new Date(2000));

  assert.equal(detectDevPluginsDir({ platform: "darwin", env: {}, home }), lane2);
  assert.equal(detectDevPluginsDir({ platform: "darwin", env: { FUYU_DEV_LANE: "1" }, home }), lane1);
  assert.equal(detectDevPluginsDir({ platform: "darwin", env: { FUYU_PLUGINS_V3_DIR: "/tmp/custom" }, home }), "/tmp/custom");
  assert.equal(detectDevPluginsDir({ platform: "darwin", env: {}, home, lane: "3" }), join(home, "Library", "Application Support", "com.tixxin.fuyu.lane-3", "plugins-v3"));
});

test("restoreMarketEntry switches a dev entry back to source: market while keeping other entries", () => {
  const yml = join(scratch, "plugins.yml");
  writeFileSync(
    yml,
    [
      "- id: messages",
      "  disabled: false",
      '- id: "@fuyu/weather"',
      "  source: dev",
      '  path: "/tmp/fuyu-plugin-dev/weather"',
      '- id: "@fuyu/world-clock"',
      "  source: market",
      "",
    ].join("\n"),
  );
  restoreMarketEntry(yml, "@fuyu/weather");
  const next = readFileSync(yml, "utf8");
  assert.match(next, /- id: "@fuyu\/weather"\n  source: market\n/);
  assert.doesNotMatch(next, /source: dev/);
  assert.match(next, /- id: "@fuyu\/world-clock"\n  source: market/);
  assert.match(next, /- id: messages/);
});
