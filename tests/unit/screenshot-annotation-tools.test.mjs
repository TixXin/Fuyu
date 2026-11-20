import assert from "node:assert/strict";
import test from "node:test";
import { annotationArea, extendAnnotation, isMeaningful, snapLine, startAnnotation, toolForKey, toolStyles, TOOL_KEYS, ANNOTATION_TOOLS } from "../../src/features/screenshot/annotations.ts";
import { annotationHandles, dragHandle, hitsAnnotation, restyleAnnotation } from "../../src/features/screenshot/annotationEdit.ts";

const STYLE = { color: "#FF3B30", level: 1 };
const selection = { x: 0, y: 0, width: 400, height: 300 };

test("Shift snaps a line to the nearest 45° and keeps how far it reaches", () => {
  assert.deepEqual(snapLine({ x: 0, y: 0 }, { x: 100, y: 7 }), { x: 100, y: 0 });
  assert.deepEqual(snapLine({ x: 0, y: 0 }, { x: 6, y: -90 }), { x: 0, y: -90 });
  const diagonal = snapLine({ x: 10, y: 10 }, { x: 60, y: 64 });
  assert.equal(diagonal.x - 10, diagonal.y - 10);
  const line = startAnnotation("line", { x: 0, y: 0 }, STYLE, 1, []);
  assert.deepEqual(extendAnnotation(line, { x: 100, y: 7 }, true).to, { x: 100, y: 0 });
  assert.deepEqual(extendAnnotation(line, { x: 100, y: 7 }).to, { x: 100, y: 7 }, "without Shift the line follows the pointer");
});

test("every tool has its own single key, and none takes C (copy colour) or T (pin)", () => {
  const keys = ANNOTATION_TOOLS.map((tool) => TOOL_KEYS[tool]);
  assert.equal(new Set(keys).size, ANNOTATION_TOOLS.length);
  assert.ok(!keys.includes("C") && !keys.includes("T"));
  assert.equal(toolForKey("l"), "line");
  assert.equal(toolForKey("B"), "blur");
  assert.equal(toolForKey("s"), "spotlight");
  assert.equal(toolForKey("q"), null);
});

test("blur and spotlight have no colour; the spotlight has no thickness either", () => {
  assert.deepEqual(toolStyles("blur"), { color: false, level: true });
  assert.deepEqual(toolStyles("spotlight"), { color: false, level: false });
  assert.deepEqual(toolStyles("line"), { color: true, level: true });
  const blur = startAnnotation("blur", { x: 0, y: 0 }, STYLE, 1, []);
  assert.equal(restyleAnnotation(blur, { color: "#0A84FF" }, 1), blur);
});

test("a spotlight changes the whole selection, so the exported patch covers all of it", () => {
  const box = { kind: "rect", color: "#FF3B30", width: 4, from: { x: 10, y: 10 }, to: { x: 50, y: 50 } };
  const spot = { kind: "spotlight", color: "#FF3B30", width: 4, from: { x: 100, y: 100 }, to: { x: 150, y: 150 } };
  assert.notDeepEqual(annotationArea([box], selection), selection);
  assert.deepEqual(annotationArea([box, spot], selection), selection);
});

test("the new shapes are drawn, picked and resized like their neighbours", () => {
  const line = { kind: "line", color: "#FF3B30", width: 4, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } };
  assert.equal(isMeaningful(line), true);
  assert.equal(hitsAnnotation(line, { x: 50, y: 4 }, 4), true);
  assert.equal(hitsAnnotation(line, { x: 50, y: 12 }, 4), false);
  assert.deepEqual(dragHandle(line, "end", { x: 20, y: 30 }).to, { x: 20, y: 30 });
  const blur = { kind: "blur", color: "#FF3B30", width: 4, from: { x: 0, y: 0 }, to: { x: 40, y: 40 } };
  assert.equal(hitsAnnotation(blur, { x: 20, y: 20 }, 4), true);
  const spot = { kind: "spotlight", color: "#FF3B30", width: 4, from: { x: 0, y: 0 }, to: { x: 100, y: 100 } };
  assert.equal(hitsAnnotation(spot, { x: 50, y: 50 }, 4), false, "a click inside a spotlight still reaches the picture");
  assert.equal(hitsAnnotation(spot, { x: 100, y: 50 }, 4), true);
  assert.equal(annotationHandles(spot).length, 4);
  assert.equal(isMeaningful(startAnnotation("spotlight", { x: 0, y: 0 }, STYLE, 1, [])), false);
});
