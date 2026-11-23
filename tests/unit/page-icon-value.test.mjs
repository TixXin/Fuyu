import assert from "node:assert/strict";
import test from "node:test";
import { clampPageText, firstEmoji, formatPageIcon, parsePageIcon } from "../../src/lib/settings/pageIconValue.ts";
import { pushPageIconRecent, readPageIconImages, readPageIconRecent } from "../../src/lib/settings/pageIconStore.ts";
import { kebabIconName, searchIcons } from "../../src/components/page-icons/lucideCatalog.ts";

test("icon names saved before C178 still read as plain icon names", () => {
  for (const name of ["star", "book-open", "gamepad-2", "calendar-days", "text", "jellyfish"]) {
    assert.deepEqual(parsePageIcon(name), { kind: "name", name });
  }
});

test("emoji, text and image values round-trip through the stored string", () => {
  const values = [
    { kind: "emoji", emoji: "🐙", mono: false },
    { kind: "emoji", emoji: "👨‍👩‍👧", mono: true },
    { kind: "text", text: "工作", bold: true },
    { kind: "text", text: "AB1", bold: false },
    { kind: "image", id: "k3j9x2m8q1w0" },
  ];
  for (const value of values) {
    const stored = formatPageIcon(value);
    assert.ok(stored.length <= 40, stored);
    assert.deepEqual(parsePageIcon(stored), value);
  }
});

test("broken or oversized values are not drawn and fall back to the default icon", () => {
  for (const raw of ["", "Star", "emoji:a", "emoji:🐙🐙", "text:", "text:工作中", "text:ABCD", "image:../x", "image:AB", "rocket:1", "x".repeat(41), null, undefined]) {
    assert.equal(parsePageIcon(raw), null, String(raw));
  }
});

test("tab text keeps at most 2 wide characters or 3 narrow ones, without emoji or spaces", () => {
  assert.equal(clampPageText("工作中"), "工作");
  assert.equal(clampPageText("ABCD"), "ABC");
  assert.equal(clampPageText("A工B"), "A工");
  assert.equal(clampPageText(" a b "), "ab");
  assert.equal(clampPageText("🐙x"), "x");
  assert.equal(firstEmoji("hi 🐙✨"), "🐙");
  assert.equal(firstEmoji("hello"), null);
});

test("the image library keeps only valid PNG data URLs and drops duplicates", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const read = readPageIconImages({ version: 1, images: [
    { id: "abcdef123456", data: png, mono: true },
    { id: "abcdef123456", data: png },
    { id: "bad", data: png },
    { id: "zzzzzz000000", data: "data:image/svg+xml;base64,PHN2Zz4=" },
    { id: "yyyyyy000000", data: `${png}<script>` },
    { id: "xxxxxx000000", data: png, mono: "yes" },
  ] });
  assert.deepEqual(read, [{ id: "abcdef123456", data: png, mono: true }, { id: "xxxxxx000000", data: png, mono: false }]);
  assert.deepEqual(readPageIconImages({ version: 2, images: [] }), []);
  assert.deepEqual(readPageIconImages("nope"), []);
});

test("recent icons are unique, newest first, capped at 8 and drop junk", () => {
  assert.deepEqual(readPageIconRecent(["star", "star", "Bad Name", 3, "emoji:🐙"]), ["star", "emoji:🐙"]);
  let recent = [];
  for (const name of ["a", "b", "c", "d", "e", "f", "g", "h", "i"]) recent = pushPageIconRecent(recent, name);
  assert.equal(recent.length, 8);
  assert.equal(recent[0], "i");
  assert.deepEqual(pushPageIconRecent(recent, "c").slice(0, 2), ["c", "i"]);
});

test("icon search finds Chinese words, English names and dashed names", () => {
  const names = ["cat", "dog", "coffee", "cup-soda", "gamepad-2", "rocket", "arrow-down-0-1"];
  assert.equal(searchIcons(names, "猫")[0], "cat");
  assert.deepEqual(searchIcons(names, "咖啡"), ["coffee"]);
  assert.deepEqual(searchIcons(names, "茶"), ["cup-soda", "coffee"]);
  assert.equal(searchIcons(names, "roc")[0], "rocket");
  assert.equal(searchIcons(names, "gamepad 2")[0], "gamepad-2");
  assert.deepEqual(searchIcons(names, "zzz"), []);
  assert.equal(kebabIconName("Gamepad2"), "gamepad-2");
});
