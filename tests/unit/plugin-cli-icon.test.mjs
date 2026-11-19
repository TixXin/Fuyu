import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { assessTone, check, findGlyph, glyphFromSvg, run, searchGlyphs } from "../../packages/plugin-cli/src/index.mjs";

const HELLO = fileURLToPath(new URL("../../packages/plugin-cli/test/fixtures/hello", import.meta.url));
const ALARM_ICON = fileURLToPath(new URL("../../plugins/v3/official/alarm/assets/icon.svg", import.meta.url));

const scratch = mkdtempSync(join(tmpdir(), "plugin-cli-icon-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let next = 0;

function hello() {
  const dir = join(scratch, `${++next}`, "hello");
  cpSync(HELLO, dir, { recursive: true });
  return dir;
}

function capture(cwd) {
  const stdout = [];
  const stderr = [];
  return {
    io: { cwd, env: {}, stdout: { write: (text) => stdout.push(text) }, stderr: { write: (text) => stderr.push(text) } },
    stdout: () => stdout.join(""),
    stderr: () => stderr.join(""),
  };
}

const text = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
const codes = (notes) => notes.map((note) => note.code);

test("icon writes the manifest's icon file in the official skeleton, and the plugin still passes check", async () => {
  const dir = hello();
  const out = capture(dir);
  assert.equal(await run(["icon", "--glyph", "alarm-clock", "--color", "#F08A24"], out.io), 0, out.stderr());
  assert.match(out.stdout(), /^replaced assets[/\\]icon\.svg \(alarm-clock, #f08a24\)\n$/);
  assert.equal(text(join(dir, "assets", "icon.svg")), text(ALARM_ICON));
  assert.match(out.stderr(), /warning: #f08a24 is the colour of the official plugin @fuyu\/alarm \[icon:same-colour\]/);
  assert.deepEqual((await check(dir)).errors, []);

  const elsewhere = capture(dir);
  assert.equal(await run(["icon", "--glyph", "alarm-check", "--color", "#c76be0", "--out", "art/alt.svg"], elsewhere.io), 0, elsewhere.stderr());
  assert.match(elsewhere.stdout(), /^wrote art[/\\]alt\.svg \(alarm-clock-check, #c76be0\)\n$/);
  assert.equal(elsewhere.stderr(), "");
  assert.ok(existsSync(join(dir, "art", "alt.svg")));
});

test("icon refuses what it cannot draw: missing options, a bad colour, an unknown glyph, a png icon", async () => {
  const dir = hello();
  const before = text(join(dir, "assets", "icon.svg"));
  const missing = capture(dir);
  assert.equal(await run(["icon", "--glyph", "rocket"], missing.io), 2);
  const colour = capture(dir);
  assert.equal(await run(["icon", "--glyph", "rocket", "--color", "orange"], colour.io), 1);
  assert.match(colour.stderr(), /--color must be a colour such as #f08a24/);
  const unknown = capture(dir);
  assert.equal(await run(["icon", "--glyph", "alarm-clok", "--color", "#f08a24"], unknown.io), 1);
  assert.match(unknown.stderr(), /"alarm-clok" is not a lucide icon name \(did you mean: alarm-clock,/);
  assert.equal(text(join(dir, "assets", "icon.svg")), before);

  const pkgFile = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  pkg.fuyu.icon = "assets/icon.png";
  writeFileSync(pkgFile, JSON.stringify(pkg));
  const png = capture(dir);
  assert.equal(await run(["icon", "--glyph", "rocket", "--color", "#e0a020"], png.io), 1);
  assert.match(png.stderr(), /fuyu\.icon is assets\/icon\.png/);
});

test("a hand-drawn glyph comes from an svg file, and has to leave the colour to the icon", async () => {
  const dir = hello();
  writeFileSync(join(dir, "drawing.svg"), '<svg viewBox="0 0 24 24">\n  <circle cx="12" cy="14" r="8" />\n  <path d="M12 10v4l2.5 1.5"/>\n</svg>\n');
  const out = capture(dir);
  assert.equal(await run(["icon", "--glyph", "drawing.svg", "--color", "#f25a4c"], out.io), 0, out.stderr());
  assert.match(text(join(dir, "assets", "icon.svg")), /stroke-linejoin="round"><circle cx="12" cy="14" r="8"\/><path d="M12 10v4l2\.5 1\.5"\/><\/g><\/svg>\n$/);

  assert.match(glyphFromSvg('<svg><path d="M1 1" fill="#fff"/></svg>').problem, /sets its own fill/);
  assert.match(glyphFromSvg('<svg><text>hi</text></svg>').problem, /<text> cannot be used/);
  assert.match(glyphFromSvg("<svg></svg>").problem, /no shapes/);
});

test("colour hints: close to an official plugin, too light, too dark, grey; its own colour is fine", () => {
  assert.deepEqual(codes(assessTone("#c76be0")), []);
  assert.equal(codes(assessTone("#4f8cff"))[0], "icon:close-colour");
  assert.match(assessTone("#4f8cff")[0].message, /close to #4f8cf7 of the official plugin @fuyu\/world-clock/);
  assert.deepEqual(codes(assessTone("#f08a24", { except: "@fuyu/alarm" })), []);
  assert.deepEqual(codes(assessTone("#ffffff")), ["icon:grey"]);
  assert.deepEqual(codes(assessTone("#808080")), ["icon:grey"]);
  assert.deepEqual(codes(assessTone("#0a2a66")), ["icon:dark"]);
  assert.deepEqual(codes(assessTone("#c9f7a8")), ["icon:light"]);
});

test("glyph names: older lucide names still resolve, and search lists names by word", async () => {
  assert.equal((await findGlyph("alarm-check")).name, "alarm-clock-check");
  assert.equal(await findGlyph("no-such-icon"), null);
  const clocks = await searchGlyphs("clock", 5);
  assert.equal(clocks[0], "clock");
  assert.ok(clocks.every((name) => name.includes("clock")));
  const listed = capture(scratch);
  assert.equal(await run(["icon", "--search", "rocket"], listed.io), 0);
  assert.match(listed.stdout(), /^rocket\n/);
});
