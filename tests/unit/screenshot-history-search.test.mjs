import assert from "node:assert/strict";
import test from "node:test";
import { compactText, coverFrame, findInLines, searchHistory } from "../../src/features/screenshot/historySearch.ts";

const word = (text, x = 0) => ({ text, x, y: 0.1, width: 0.1, height: 0.05 });
const shots = [
  { path: "a.png", words: [[word("Build"), word("failed", 0.2)], [word("错误"), word("代码", 0.2)]] },
  { path: "b.png", words: [[word("Hello"), word("World", 0.2)]] },
  { path: "c.png", words: null },
  { path: "d.png", words: [] },
];

test("an empty search keeps every screenshot, without marks", () => {
  assert.deepEqual(searchHistory(shots, "  ").map((match) => [match.item.path, match.hits.length]), [["a.png", 0], ["b.png", 0], ["c.png", 0], ["d.png", 0]]);
});

test("a search keeps only screenshots with that text, ignoring case, spaces and full-width letters", () => {
  assert.deepEqual(searchHistory(shots, "FAILED").map((match) => match.item.path), ["a.png"]);
  assert.deepEqual(searchHistory(shots, "ｈｅｌｌｏ ｗｏｒｌｄ").map((match) => match.item.path), ["b.png"]);
  assert.deepEqual(searchHistory(shots, "误代").map((match) => match.item.path), ["a.png"]);
  assert.deepEqual(searchHistory(shots, "nowhere"), []);
});

test("the words a match runs across are the ones marked, and a match never spans two lines", () => {
  const [build, failed] = shots[0].words[0];
  assert.deepEqual(findInLines(shots[0].words, "ldfai"), [build, failed]);
  assert.deepEqual(findInLines(shots[0].words, "fail"), [failed]);
  assert.equal(findInLines(shots[0].words, "failed错误"), null);
  assert.equal(findInLines(null, "x"), null, "a screenshot not read yet has no hits");
  assert.equal(compactText(" A b\tＣ "), "abc");
});

test("marks sit on the part of the picture the cover-cropped thumbnail shows", () => {
  assert.deepEqual(coverFrame(1600, 1000, 1.6), { left: 0, top: 0, width: 100, height: 100 });
  assert.deepEqual(coverFrame(3200, 1000, 1.6), { left: -50, top: 0, width: 200, height: 100 });
  assert.deepEqual(coverFrame(800, 1000, 1.6), { left: 0, top: 0, width: 100, height: 200 });
  assert.deepEqual(coverFrame(0, 0, 1.6), { left: 0, top: 0, width: 100, height: 100 });
});
