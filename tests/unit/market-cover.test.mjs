import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { iconTint, isStripShot } from "../../src/windows/settings/marketCover.ts";

const OFFICIAL = new URL("../../plugins/v3/official/", import.meta.url);
const svg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="${fill}" fill-opacity="0.16"/><g stroke="${fill}"><path d="M12 2v2"/></g></svg>`;
const base64 = (text) => `data:image/svg+xml;base64,${Buffer.from(text).toString("base64")}`;

test("the cover colour is the fill of the icon's first rect, whether the icon arrives base64 or URL-encoded", () => {
  assert.equal(iconTint(base64(svg("#22A8EE"))), "#22a8ee");
  assert.equal(iconTint(`data:image/svg+xml,${encodeURIComponent(svg("#f08a24"))}`), "#f08a24");
  assert.equal(iconTint(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg("#abc"))}`), "#abc");
});

test("an icon that is not an inline SVG with a filled rect gives no colour, so the cover stays neutral", () => {
  assert.equal(iconTint(null), null);
  assert.equal(iconTint("https://market.example/icon.svg"), null);
  assert.equal(iconTint("data:image/png;base64,iVBORw0KGgo="), null);
  assert.equal(iconTint(base64('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4" fill="#ff0000"/></svg>')), null);
  assert.equal(iconTint(base64('<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4" fill="url(#g)"/></svg>')), null);
  assert.equal(iconTint("data:image/svg+xml,%E0%A4%A"), null);
  assert.equal(iconTint("data:image/svg+xml;base64,@@not-base64@@"), null);
});

test("every official plugin icon yields its own main colour", () => {
  const tints = readdirSync(OFFICIAL, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [entry.name, iconTint(base64(readFileSync(new URL(`${entry.name}/assets/icon.svg`, OFFICIAL), "utf8")))]);
  assert.ok(tints.length >= 12);
  for (const [name, tint] of tints) assert.match(tint ?? "", /^#[0-9a-f]{6}$/, name);
  assert.equal(new Set(tints.map(([, tint]) => tint)).size, tints.length);
});

test("a collapsed-bar screenshot counts as a strip and a page screenshot does not", () => {
  assert.equal(isStripShot(522, 40), true);
  assert.equal(isStripShot(794, 360), false);
  assert.equal(isStripShot(794, 459), false);
  assert.equal(isStripShot(0, 0), false);
});
