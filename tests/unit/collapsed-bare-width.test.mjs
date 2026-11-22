import assert from "node:assert/strict";
import test from "node:test";
import { collapsedWidth } from "../../src/windows/island/collapsedWidth.ts";
import { contentNeed } from "../../src/windows/island/collapsedContent.ts";
import { MIN_BARE_COLLAPSED_WIDTH, MIN_COLLAPSED_ISLAND_WIDTH } from "../../src/windows/island/layout.ts";

const base = { lines: [], noticeText: null, appName: "Fuyu", showTitle: false, widthExtra: 0, peeking: false, center: false, centerWidth: 0, sideWidth: 0, viewportWidth: 820, devicePixelRatio: 1 };
const todoLine = { id: "todos", item: "todos.line", measure: "3 个待办", order: 1 };

test("with nothing written on the bar the island hugs its items instead of the old 280px floor", () => {
  const width = collapsedWidth({ ...base, contentWidth: 168, fitWidth: 128 });
  assert.ok(width >= 168 && width <= 172, String(width));
  assert.ok(width < MIN_COLLAPSED_ISLAND_WIDTH - 60);
});

test("a todo line, a title, a message preview, an alert or a notice keep today's width", () => {
  const before = (input) => collapsedWidth({ ...input, contentWidth: 0 });
  for (const input of [
    { ...base, lines: [todoLine] },
    { ...base, showTitle: true },
    { ...base, peeking: true },
    { ...base, alerted: true },
    { ...base, noticeText: "已复制" },
  ]) assert.equal(collapsedWidth({ ...input, contentWidth: 150 }), before(input));
});

test("before the bar has been measured the width falls back to the old formula", () => {
  assert.equal(collapsedWidth({ ...base, contentWidth: 0 }), collapsedWidth(base));
  assert.ok(collapsedWidth(base) >= MIN_COLLAPSED_ISLAND_WIDTH);
});

test("the width setting still widens a bare bar but never cuts into its items, and it never collapses to nothing", () => {
  const plain = collapsedWidth({ ...base, contentWidth: 160 });
  assert.ok(collapsedWidth({ ...base, contentWidth: 160, widthExtra: 60 }) >= plain + 56);
  assert.ok(collapsedWidth({ ...base, contentWidth: 160, widthExtra: -60 }) >= 160);
  assert.ok(collapsedWidth({ ...base, contentWidth: 20 }) >= MIN_BARE_COLLAPSED_WIDTH);
});

test("pixel alignment only nudges a bare bar wider, so items are never clipped", () => {
  for (const ratio of [1, 1.25, 1.5, 1.75]) {
    for (let content = 100; content < 200; content += 1) {
      assert.ok(collapsedWidth({ ...base, contentWidth: content, devicePixelRatio: ratio }) >= content, `${content} @${ratio}`);
    }
  }
});

test("a centred pattern needs the wider side mirrored around it", () => {
  assert.equal(contentNeed({ padStart: 18, padEnd: 18, left: 40, right: 100, open: 0, center: 60 }), 60 + 2 * 118);
  assert.equal(contentNeed({ padStart: 18, padEnd: 18, left: 40, right: 100, open: 8, center: 0 }), 184);
});
