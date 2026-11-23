import assert from "node:assert/strict";
import test from "node:test";
import { createGlassCaptureHub } from "../../src/windows/island/glassCaptureHub.ts";

function rig() {
  const calls = { starts: 0, stops: 0 };
  const delivers = [];
  const hub = createGlassCaptureHub(() => {
    calls.stops += 1;
  });
  const start = (next) => {
    calls.starts += 1;
    delivers.push(next);
    return Promise.resolve({ started: true, reason: null });
  };
  return { hub, calls, start, delivers, send: (data) => delivers.at(-1)(data) };
}

test("the bar and the panel of the split taskbar island share one capture and both get every frame", () => {
  const { hub, calls, start, send } = rig();
  const bar = [];
  const panel = [];
  hub.join((data) => bar.push(data), start);
  hub.join((data) => panel.push(data), start);
  assert.equal(calls.starts, 1, "the second layer does not start a capture that would replace the first one's channel");
  send("frame 1");
  assert.deepEqual([bar, panel], [["frame 1"], ["frame 1"]]);
});

test("a layer that joins late is shown the last frame at once", () => {
  const { hub, start, send } = rig();
  hub.join(() => {}, start);
  send("frame 1");
  const late = [];
  hub.join((data) => late.push(data), start);
  assert.deepEqual(late, ["frame 1"]);
});

test("the capture stops only when the last layer leaves, and a new join starts it again without stale frames", () => {
  const { hub, calls, start, delivers, send } = rig();
  const bar = hub.join(() => {}, start);
  const panelFrames = [];
  const panel = hub.join((data) => panelFrames.push(data), start);
  bar.leave();
  bar.leave();
  assert.equal(calls.stops, 0, "the panel keeps its frames after the bar unmounts");
  send("frame 1");
  assert.deepEqual(panelFrames, ["frame 1"]);
  panel.leave();
  assert.equal(calls.stops, 1);
  const again = [];
  hub.join((data) => again.push(data), start);
  assert.equal(calls.starts, 2);
  assert.deepEqual(again, [], "no frame from the stopped capture is replayed");
  delivers[0]("late frame of the stopped capture");
  assert.deepEqual(again, [], "a frame still in flight from the stopped capture is dropped");
  send("frame 2");
  assert.deepEqual(again, ["frame 2"]);
});

test("every layer learns the shared capture could not start", async () => {
  const hub = createGlassCaptureHub(() => {});
  const failed = () => Promise.resolve({ started: false, reason: "remote" });
  const first = hub.join(() => {}, failed);
  const second = hub.join(() => {}, failed);
  assert.deepEqual(await second.started, await first.started);
  assert.equal((await second.started).reason, "remote");
});
