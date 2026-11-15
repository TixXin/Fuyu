import test from "node:test";
import assert from "node:assert/strict";
import { copyNoticeLabel, copyNoticeThumbnail } from "../../src/features/clipboard/copyNotice.ts";

const base = { hash: "h", createdAt: 1, copiedAt: 1 };

test("text collapses whitespace and is cut to one short line", () => {
  assert.deepEqual(copyNoticeLabel({ ...base, id: "a", kind: "text", preview: "a\n\n  b" }), { kind: "text", summary: "a b" });
  const long = copyNoticeLabel({ ...base, id: "b", kind: "text", preview: "x".repeat(200) });
  assert.equal(long.kind === "text" && long.summary.length, 80);
});

test("links read as host and path", () => {
  const label = copyNoticeLabel({ ...base, id: "c", kind: "text", preview: "https://www.example.com/a/b", text: "https://www.example.com/a/b" });
  assert.deepEqual(label, { kind: "text", summary: "example.com › a/b" });
});

test("masked entries never carry their text", () => {
  assert.deepEqual(copyNoticeLabel({ ...base, id: "d", kind: "text", preview: "sk-•••", masked: true }), { kind: "masked" });
});

test("files give the first name and how many more", () => {
  assert.deepEqual(copyNoticeLabel({ ...base, id: "e", kind: "files", preview: "x", files: ["/Users/me/a.pdf", "/Users/me/b.txt", "C:\\x\\c.md"] }), { kind: "files", name: "a.pdf", more: 2 });
});

test("thumbnails come from the image or the file image", () => {
  assert.equal(copyNoticeThumbnail({ ...base, id: "f", kind: "image", preview: "", image: { width: 1, height: 1, byteSize: 1, originalPath: "", thumbnailPath: "", thumbnailDataUrl: "data:x" } }), "data:x");
  assert.equal(copyNoticeThumbnail({ ...base, id: "g", kind: "files", preview: "", fileImage: { width: 1, height: 1, byteSize: 1, thumbnailDataUrl: "data:y" } }), "data:y");
  assert.equal(copyNoticeThumbnail({ ...base, id: "h", kind: "text", preview: "" }), null);
});
