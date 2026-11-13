import assert from "node:assert/strict";
import test from "node:test";
import { lineText, newMosaics, redactionRects, sensitiveRanges } from "../../src/features/screenshot/redact.ts";

const found = (text) => sensitiveRanges(text).map(({ start, end }) => text.slice(start, end));

test("emails, phone numbers and IP addresses are found, with the spaces OCR leaves in them", () => {
  assert.deepEqual(found("联系 tixxin@example.com 或 138 1234 5678"), ["tixxin@example.com", "138 1234 5678"]);
  assert.deepEqual(found("call +86 13812345678 or +1 415 555 0134"), ["+86 13812345678", "+1 415 555 0134"]);
  assert.deepEqual(found("ssh root@10.0.12.7 port 22"), ["10.0.12.7"]);
  assert.deepEqual(found("addr 2001:db8:85a3:0:0:8a2e:370:7334"), ["2001:db8:85a3:0:0:8a2e:370:7334"]);
});

test("version numbers, times, short numbers and plain hashes are left alone", () => {
  assert.deepEqual(found("v0.3.7 at 12:30:45 build 999.1.1.1 order 12345678"), []);
  assert.deepEqual(found("commit 3f2a9c4d8e7b6a5f4e3d2c1b0a9f8e7d6c5b4a39"), []);
});

test("keys are found by their prefix, after a label, or as a long mixed-case token", () => {
  assert.deepEqual(found("ANTHROPIC_API_KEY sk-ant-api03-AbCdEfGh12345678"), ["sk-ant-api03-AbCdEfGh12345678"]);
  assert.deepEqual(found("token ghp_ABCDEFGHIJKLMNOPQRSTuvwx1234"), ["ghp_ABCDEFGHIJKLMNOPQRSTuvwx1234"]);
  assert.deepEqual(found("aws AKIAIOSFODNN7EXAMPLE"), ["AKIAIOSFODNN7EXAMPLE"]);
  assert.deepEqual(found("password: hunter22, user: me"), ["hunter22"]);
  assert.deepEqual(found("密码：Abc12345"), ["Abc12345"]);
  assert.deepEqual(found("x aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3 y"), ["aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3"]);
});

test("words join with spaces except between Chinese characters", () => {
  const words = ["联", "系", "a@b.cn"].map((text) => ({ text, x: 0, y: 0, width: 1, height: 1 }));
  const { text, spans } = lineText(words);
  assert.equal(text, "联系 a@b.cn");
  assert.deepEqual(spans, [{ start: 0, end: 1 }, { start: 1, end: 2 }, { start: 3, end: 9 }]);
});

test("a match covers the boxes of its words, padded and kept inside the selection", () => {
  const line = [
    { text: "mail", x: 100, y: 50, width: 30, height: 12 },
    { text: "a@b.com", x: 140, y: 50, width: 60, height: 12 },
    { text: "now", x: 210, y: 50, width: 25, height: 12 },
  ];
  assert.deepEqual(redactionRects([line], { x: 0, y: 0, width: 1000, height: 1000 }), [{ x: 138, y: 48, width: 64, height: 16 }]);
  assert.deepEqual(redactionRects([line], { x: 150, y: 49, width: 30, height: 30 }), [{ x: 150, y: 49, width: 30, height: 15 }]);
  assert.deepEqual(redactionRects([[{ text: "hello", x: 0, y: 0, width: 10, height: 10 }]], { x: 0, y: 0, width: 50, height: 50 }), []);
});

test("auto mosaics are marked, and running it again adds none twice", () => {
  const rect = { x: 10, y: 20, width: 80, height: 18 };
  const [mosaic] = newMosaics([rect], []);
  assert.equal(mosaic.kind, "mosaic");
  assert.equal(mosaic.auto, true);
  assert.deepEqual([mosaic.from, mosaic.to], [{ x: 10, y: 20 }, { x: 90, y: 38 }]);
  assert.deepEqual(newMosaics([rect], [mosaic]), []);
});
