import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { OFFICIAL_ICONS, findGlyph, renderIcon } from "../../packages/plugin-cli/src/index.mjs";

const OFFICIAL_ROOT = fileURLToPath(new URL("../../plugins/v3/official", import.meta.url));

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)].map((match) => [match[1], match[2]]));
}

function readIcon(dir) {
  const pkg = JSON.parse(readFileSync(join(OFFICIAL_ROOT, dir, "package.json"), "utf8"));
  const svg = readFileSync(join(OFFICIAL_ROOT, dir, pkg.fuyu.icon), "utf8");
  const tags = [...svg.matchAll(/<([a-zA-Z]+)\b[^>]*>/g)].map((match) => ({ name: match[1], attrs: attributes(match[0]) }));
  return { id: pkg.name, tags };
}

test("every official plugin icon is a tinted rounded tile with a line glyph in the same colour, one colour per plugin", () => {
  const tones = new Map();
  for (const dir of readdirSync(OFFICIAL_ROOT).sort()) {
    const { id, tags } = readIcon(dir);
    const [root, tile, glyph, ...shapes] = tags;
    assert.equal(root.name, "svg", id);
    assert.equal(root.attrs.viewBox, "0 0 24 24", `${id} viewBox`);
    assert.deepEqual(
      { name: tile.name, width: tile.attrs.width, height: tile.attrs.height, rx: tile.attrs.rx, opacity: tile.attrs["fill-opacity"], offset: tile.attrs.x ?? tile.attrs.y ?? null },
      { name: "rect", width: "24", height: "24", rx: "6", opacity: "0.16", offset: null },
      `${id} tile`,
    );
    assert.match(tile.attrs.fill, /^#[0-9a-f]{6}$/, `${id} tile colour`);
    assert.deepEqual(
      { name: glyph.name, fill: glyph.attrs.fill, stroke: glyph.attrs.stroke, width: glyph.attrs["stroke-width"], transform: glyph.attrs.transform },
      { name: "g", fill: "none", stroke: tile.attrs.fill, width: "2", transform: "translate(5.28 5.28) scale(0.56)" },
      `${id} glyph`,
    );
    assert.ok(shapes.length > 0, `${id} has a glyph`);
    for (const shape of shapes) {
      assert.ok(["path", "circle", "rect", "line", "polyline", "ellipse"].includes(shape.name), `${id} draws with <${shape.name}>`);
      assert.equal(shape.attrs.fill ?? shape.attrs.stroke ?? shape.attrs.style ?? null, null, `${id} <${shape.name}> sets its own colour`);
    }
    assert.equal(tones.get(tile.attrs.fill), undefined, `${id} shares ${tile.attrs.fill} with ${tones.get(tile.attrs.fill)}`);
    tones.set(tile.attrs.fill, id);
  }
  assert.ok(tones.size > 0);
});

test("fuyu-plugin icon knows every official plugin's colour and redraws the lucide ones byte for byte", async () => {
  const dirs = readdirSync(OFFICIAL_ROOT).sort();
  assert.deepEqual(Object.keys(OFFICIAL_ICONS).sort(), dirs.map((dir) => `@fuyu/${dir}`));
  for (const dir of dirs) {
    const { id, tags } = readIcon(dir);
    const { color, glyph } = OFFICIAL_ICONS[id];
    assert.equal(tags[1].attrs.fill, color, `${id} colour`);
    if (glyph === null) continue;
    const pkg = JSON.parse(readFileSync(join(OFFICIAL_ROOT, dir, "package.json"), "utf8"));
    const current = readFileSync(join(OFFICIAL_ROOT, dir, pkg.fuyu.icon), "utf8").replaceAll("\r\n", "\n");
    assert.equal(renderIcon({ body: (await findGlyph(glyph)).body, color }), current, `${id} drawn from ${glyph}`);
  }
});
