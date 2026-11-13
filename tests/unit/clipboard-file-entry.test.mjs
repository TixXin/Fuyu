import assert from "node:assert/strict";
import test from "node:test";
import { fileFolder, fileImageLabel, fileKind, itemFileKind, sourceName } from "../../src/features/clipboard/fileEntry.ts";

const files = (paths, extra = {}) => ({ id: "f", kind: "files", hash: "", createdAt: 0, copiedAt: 0, preview: "", files: paths, ...extra });

test("copied files are grouped by extension", () => {
  assert.equal(fileKind("/Users/me/Downloads/PixPin_2026.JPG"), "image");
  assert.equal(fileKind(String.raw`C:\clips\talk.mp4`), "video");
  assert.equal(fileKind("/tmp/release.zip"), "archive");
  assert.equal(fileKind("/tmp/notes.md"), "document");
  assert.equal(fileKind("/tmp/main.rs"), "code");
  assert.equal(fileKind("/tmp/Makefile"), "other");
  assert.equal(fileKind("/tmp/.env"), "other");
});

test("several files share a kind only when they all match", () => {
  assert.equal(itemFileKind(files(["/a/1.png", "/a/2.jpg"])), "image");
  assert.equal(itemFileKind(files(["/a/1.png", "/a/2.pdf"])), "other");
  assert.equal(itemFileKind({ ...files([]), kind: "text" }), null);
});

test("the folder is the file's parent directory", () => {
  assert.equal(fileFolder("/Users/me/Downloads/a.jpg"), "Downloads");
  assert.equal(fileFolder(String.raw`C:\Users\me\Desktop\b.png`), "Desktop");
  assert.equal(fileFolder("a.jpg"), null);
});

test("an image file reads as its size and bytes", () => {
  const item = files(["/a/1.png"], { fileImage: { width: 1280, height: 720, byteSize: 2048, thumbnailDataUrl: "data:" } });
  assert.equal(fileImageLabel(item, (bytes) => `${bytes} B`), "1280×720 · 2048 B");
  assert.equal(fileImageLabel(files(["/a/1.png"]), String), null);
});

test("Fuyu's own copies show the app's name", () => {
  assert.equal(sourceName(files([], { source: { path: "/x/fuyu", name: "fuyu" } }), "浮屿"), "浮屿");
  assert.equal(sourceName(files([], { source: { path: "/Applications/Fuyu.app", name: "Fuyu" } }), "Fuyu"), "Fuyu");
  assert.equal(sourceName(files([], { source: { path: "/Applications/WeChat.app", name: "WeChat" } }), "浮屿"), "WeChat");
  assert.equal(sourceName(files([]), "浮屿"), undefined);
});
