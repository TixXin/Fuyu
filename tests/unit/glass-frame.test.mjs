import assert from "node:assert/strict";
import test from "node:test";
import { frameLuminance, glassFramePlacement, parseGlassMessage } from "../../src/windows/island/glassFrame.ts";
import { resolveGlassStatus } from "../../src/windows/island/glassStatus.ts";

function frameBytes(rect, width, height, pixel) {
  const bytes = new Uint8Array(24 + width * height * 4);
  const view = new DataView(bytes.buffer);
  rect.forEach((value, index) => view.setInt32(index * 4, value, true));
  view.setUint32(16, width, true);
  view.setUint32(20, height, true);
  for (let at = 24; at < bytes.length; at += 4) bytes.set(pixel, at);
  return bytes;
}

test("a live frame carries its rectangle on the window and its RGBA pixels, as Rust's encode writes them", () => {
  const bytes = frameBytes([-20, 0, 1180, 460], 2, 1, [1, 2, 3, 255]);
  const message = parseGlassMessage(bytes.buffer);
  assert.equal(message.kind, "frame");
  assert.deepEqual([message.frame.left, message.frame.top, message.frame.right, message.frame.bottom], [-20, 0, 1180, 460]);
  assert.deepEqual([...message.frame.pixels], [1, 2, 3, 255, 1, 2, 3, 255]);
  assert.equal(parseGlassMessage([...bytes]).frame.width, 2, "a small message can come as a plain array");
});

test("a one-byte message is the capture giving up, with the reason Rust sent", () => {
  assert.deepEqual(parseGlassMessage(new Uint8Array([2]).buffer), { kind: "failed", reason: "no-d3d" });
  assert.deepEqual(parseGlassMessage([3]), { kind: "failed", reason: "remote" });
  assert.deepEqual(parseGlassMessage([99]), { kind: "failed", reason: "failed" });
});

test("empty and truncated messages are ignored rather than drawn", () => {
  assert.deepEqual(parseGlassMessage(new ArrayBuffer(0)), { kind: "none" });
  const short = frameBytes([0, 0, 8, 8], 4, 4, [0, 0, 0, 255]).slice(0, 40);
  assert.deepEqual(parseGlassMessage(short.buffer), { kind: "none" });
});

test("the frame is placed over the window, seen from the island, in CSS pixels", () => {
  const frame = parseGlassMessage(frameBytes([0, 0, 1230, 690], 307, 172, [0, 0, 0, 255]).buffer).frame;
  assert.deepEqual(glassFramePlacement(frame, 1.5, { left: 130, top: 0, width: 560, height: 360 }), {
    left: -130, top: 0, width: 820, height: 460,
  });
  assert.deepEqual(glassFramePlacement(frame, 0, { left: 0, top: 10, width: 1, height: 1 }).top, -10);
});

test("the brightness behind the island is read from the part of the frame under it", () => {
  const bytes = frameBytes([0, 0, 200, 100], 20, 10, [0, 0, 0, 255]);
  for (let y = 0; y < 10; y += 1) for (let x = 10; x < 20; x += 1) bytes.set([255, 255, 255, 255], 24 + (y * 20 + x) * 4);
  const frame = parseGlassMessage(bytes.buffer).frame;
  assert.equal(frameLuminance(frame, 1, { left: 0, top: 0, width: 100, height: 100 }), 0);
  assert.equal(frameLuminance(frame, 1, { left: 100, top: 0, width: 100, height: 100 }), 1);
  assert.equal(frameLuminance(frame, 2, { left: 50, top: 0, width: 50, height: 50 }), 1);
});

const base = { enabled: true, choice: "native", transparencyOff: false, live: { state: "live" }, wallpaper: "ready" };

test("live windows fall back to the wallpaper, then to the CSS glass, keeping why", () => {
  assert.deepEqual(resolveGlassStatus(base), { backdrop: "live" });
  assert.deepEqual(resolveGlassStatus({ ...base, live: { state: "starting" } }), { backdrop: "live" });
  const failed = { ...base, live: { state: "failed", reason: "remote" } };
  assert.deepEqual(resolveGlassStatus(failed), { backdrop: "wallpaper", reason: "remote" });
  assert.deepEqual(resolveGlassStatus({ ...failed, wallpaper: "loading" }), { backdrop: "wallpaper", reason: "remote" });
  assert.deepEqual(resolveGlassStatus({ ...failed, wallpaper: "unavailable" }), { backdrop: "css", reason: "remote" });
});

test("transparency effects off go straight to the CSS glass, whatever was chosen", () => {
  assert.deepEqual(resolveGlassStatus({ ...base, transparencyOff: true }), { backdrop: "css", reason: "transparency-off" });
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "wallpaper", transparencyOff: true }), { backdrop: "css", reason: "transparency-off" });
});

test("the wallpaper and none choices carry no reason unless the wallpaper fails, and off is off", () => {
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "wallpaper", live: { state: "failed", reason: "failed" } }), { backdrop: "wallpaper" });
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "wallpaper", wallpaper: "unavailable" }), { backdrop: "css", reason: "no-wallpaper" });
  assert.deepEqual(resolveGlassStatus({ ...base, choice: "none", live: { state: "failed", reason: "failed" } }), { backdrop: "css" });
  assert.deepEqual(resolveGlassStatus({ ...base, enabled: false, transparencyOff: true }), { backdrop: "off" });
});
