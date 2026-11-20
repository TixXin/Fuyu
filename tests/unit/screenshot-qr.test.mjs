import assert from "node:assert/strict";
import test from "node:test";
import { sameSelection, webLink } from "../../src/features/screenshot/qrText.ts";

test("only a whole http(s) address is offered as a link to open", () => {
  assert.equal(webLink(" https://example.com/a?b=1 "), "https://example.com/a?b=1");
  assert.equal(webLink("http://192.168.1.1:8080"), "http://192.168.1.1:8080");
  assert.equal(webLink("javascript:alert(1)"), null);
  assert.equal(webLink("file:///etc/passwd"), null);
  assert.equal(webLink("weixin://dl/business/?t=abc"), null, "app schemes are copied, not opened");
  assert.equal(webLink("see https://example.com"), null, "text that only contains a link is text");
  assert.equal(webLink("https://"), null);
});

test("QR results belong to the selection they were read from", () => {
  const rect = { x: 1, y: 2, width: 30, height: 40 };
  assert.equal(sameSelection(rect, { ...rect }), true);
  assert.equal(sameSelection(rect, { ...rect, width: 31 }), false);
  assert.equal(sameSelection(rect, null), false);
  assert.equal(sameSelection(null, null), true);
});
