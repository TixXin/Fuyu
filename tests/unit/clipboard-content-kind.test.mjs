import assert from "node:assert/strict";
import test from "node:test";
import { colorFormats, contentKind, linkLabel, parseColor, stripTracking } from "../../src/features/clipboard/contentKind.ts";
import { loadPinyin, matchesPopupQuery, parsePopupQuery } from "../../src/features/clipboard/popupQuery.ts";

const text = (value, extra = {}) => ({ id: value, kind: "text", hash: value, createdAt: 0, copiedAt: 0, preview: value, text: value, ...extra });

test("links, colours and JSON are told apart from plain text", () => {
  assert.equal(contentKind(text("https://github.com/TixXin/fuyu/pull/26"))?.kind, "link");
  assert.equal(contentKind(text("see https://github.com")), null);
  assert.equal(contentKind(text("#E86A92"))?.kind, "color");
  assert.equal(contentKind(text("hsl(341, 73%, 66%)"))?.kind, "color");
  assert.equal(contentKind(text('{"a":1}'))?.kind, "json");
  assert.equal(contentKind(text("{not json}")), null);
  assert.equal(contentKind(text("#E86A92", { masked: true })), null);
});

test("a link reads as host and path, and loses its tracking parameters", () => {
  assert.equal(linkLabel(new URL("https://www.github.com/TixXin/fuyu/pull/26")), "github.com › TixXin/fuyu › pull/26");
  assert.equal(stripTracking("https://a.com/x?id=3&utm_source=chat&fbclid=9"), "https://a.com/x?id=3");
  assert.equal(stripTracking("https://a.com/x?id=3"), "https://a.com/x?id=3");
});

test("a colour is written as HEX, RGB and HSL", () => {
  assert.deepEqual(colorFormats(parseColor("#e86a92")), { hex: "#E86A92", rgb: "rgb(232, 106, 146)", hsl: "hsl(341, 73%, 66%)" });
  assert.equal(colorFormats(parseColor("rgb(59, 130, 246)")).hex, "#3B82F6");
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
});

test("the search takes / rules, and a rule still being typed narrows nothing", () => {
  assert.deepEqual(parsePopupQuery("/app:微信 hy /img"), { words: ["hy"], rules: [{ rule: "app", name: "微信" }, { rule: "img" }] });
  assert.deepEqual(parsePopupQuery("/to"), { words: [], rules: [] });
  assert.deepEqual(parsePopupQuery("/usr/bin"), { words: ["/usr/bin"], rules: [] });
  const now = new Date(2026, 10, 10, 12).getTime();
  const old = text("old", { copiedAt: now - 3 * 86_400_000, source: { path: "", name: "Weixin" } });
  assert.equal(matchesPopupQuery(old, parsePopupQuery("/today"), now), false);
  assert.equal(matchesPopupQuery(old, parsePopupQuery("/week /app:weix"), now), true);
});

test("Chinese matches by its pinyin and by the first letters", async () => {
  const pinyin = await loadPinyin();
  assert.ok(pinyin);
  const item = text("下午三点的会议改到四点");
  assert.equal(matchesPopupQuery(item, parsePopupQuery("hy"), 0, pinyin), true);
  assert.equal(matchesPopupQuery(item, parsePopupQuery("huiyi"), 0, pinyin), true);
  assert.equal(matchesPopupQuery(item, parsePopupQuery("zz"), 0, pinyin), false);
});
