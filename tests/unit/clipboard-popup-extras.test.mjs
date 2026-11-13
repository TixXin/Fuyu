import assert from "node:assert/strict";
import test from "node:test";
import { parseLink } from "../../src/features/clipboard/contentKind.ts";
import { dayGroup, dayGroupStarts } from "../../src/features/clipboard/dayGroup.ts";
import { fileFolder, fileImageLabel, sourceName } from "../../src/features/clipboard/fileEntry.ts";

test("bare domains are links, file names and versions are not", () => {
  assert.equal(parseLink("edge.microsoft.com")?.href, "https://edge.microsoft.com/");
  assert.equal(parseLink("github.com/TixXin/fuyu")?.hostname, "github.com");
  assert.equal(parseLink("example.co.uk:8080/a?b=1")?.port, "8080");
  assert.equal(parseLink("notes.md"), null);
  assert.equal(parseLink("PixPin_2026.jpg"), null);
  assert.equal(parseLink("1.2.3"), null);
  assert.equal(parseLink("hello world.com"), null);
  assert.equal(parseLink("https://www.bing.com/search?q=1")?.hostname, "www.bing.com");
});

test("rows are grouped into today, yesterday and earlier", () => {
  const now = new Date(2026, 10, 13, 10, 30).getTime();
  assert.equal(dayGroup(new Date(2026, 10, 13, 0, 1).getTime(), now), "today");
  assert.equal(dayGroup(new Date(2026, 10, 12, 23, 59).getTime(), now), "yesterday");
  assert.equal(dayGroup(new Date(2026, 10, 11, 12).getTime(), now), "earlier");
  const times = [now - 1, now - 2, new Date(2026, 10, 12, 9).getTime(), new Date(2026, 9, 1).getTime(), new Date(2026, 8, 1).getTime()];
  assert.deepEqual(dayGroupStarts(times, now), ["today", null, "yesterday", "earlier", null]);
});

test("temporary and dated folders are not worth naming", () => {
  assert.equal(fileFolder("/Users/me/Library/Application Support/PixPin/Temp/a.jpg"), null);
  assert.equal(fileFolder("/x/temp/RWTemp/2026-11/a.jpg"), null);
  assert.equal(fileFolder("/Users/me/Downloads/a.jpg"), "Downloads");
});

test("an image file without a readable size shows only its pixels", () => {
  const item = { id: "f", kind: "files", hash: "", createdAt: 0, copiedAt: 0, preview: "", files: ["/a.jpg"], fileImage: { width: 800, height: 600, byteSize: 0, thumbnailDataUrl: "data:" } };
  assert.equal(fileImageLabel(item, () => "x"), "800×600");
});

test("Fuyu's own pictures read as screenshots", () => {
  const own = { path: "/x/fuyu", name: "fuyu" };
  assert.equal(sourceName({ id: "i", kind: "image", hash: "", createdAt: 0, copiedAt: 0, preview: "", source: own }, "浮屿", "截图"), "截图");
  assert.equal(sourceName({ id: "t", kind: "text", hash: "", createdAt: 0, copiedAt: 0, preview: "", source: own }, "浮屿", "截图"), "浮屿");
});

test("holding space past the threshold makes the preview close on release", async () => {
  const { PEEK_HOLD_MS, releaseEndsPeek } = await import("../../src/features/clipboard/popupKeys.ts");
  assert.equal(releaseEndsPeek(PEEK_HOLD_MS - 1), false);
  assert.equal(releaseEndsPeek(PEEK_HOLD_MS), true);
});
