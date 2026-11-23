import assert from "node:assert/strict";
import test from "node:test";
import { TRAY_MARK_HEIGHT as H, TRAY_MARK_WIDTH as W, trayMarkAlpha } from "../../src/components/jellyfish/pixel/trayMark.ts";
import { PIXEL_GRIDS } from "../../src/components/jellyfish/pixel/pixelGrids.ts";
import { PIXEL_STYLES } from "../../src/components/jellyfish/pixel/pixelStyles.ts";

function holes(alpha) {
  const seen = new Uint8Array(W * H);
  const spread = (start) => {
    const queue = [start];
    seen[start] = 1;
    while (queue.length) {
      const at = queue.pop();
      const x = at % W;
      const y = (at - x) / W;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const next = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[next] || alpha[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
  };
  for (let x = 0; x < W; x += 1) for (const y of [0, H - 1]) if (!alpha[y * W + x] && !seen[y * W + x]) spread(y * W + x);
  for (let y = 0; y < H; y += 1) for (const x of [0, W - 1]) if (!alpha[y * W + x] && !seen[y * W + x]) spread(y * W + x);
  let count = 0;
  for (let at = 0; at < W * H; at += 1) {
    if (alpha[at] || seen[at]) continue;
    count += 1;
    spread(at);
  }
  return count;
}

function squareSize(alpha) {
  let run = 0;
  let shortest = W;
  for (let at = 0; at < W * H; at += 1) {
    const edge = at % W === 0;
    if (!edge && alpha[at] === alpha[at - 1]) run += 1;
    else {
      if (run && alpha[at - 1]) shortest = Math.min(shortest, run);
      run = 1;
    }
  }
  return shortest;
}

test("the menu bar mark of every pixel look fills the 52 by 36 template with whole squares", () => {
  for (const style of Object.keys(PIXEL_STYLES)) {
    const alpha = trayMarkAlpha(style);
    assert.equal(alpha.length, W * H, style);
    assert.ok(alpha.every((value) => Number.isInteger(value) && value >= 0 && value <= 255), style);
    assert.ok(alpha.some((value) => value === 255), style);
    const rows = [...Array(H).keys()].filter((y) => alpha.slice(y * W, (y + 1) * W).some(Boolean));
    assert.ok(rows.length >= 32, `${style} is ${rows.length} px tall`);
    assert.equal(squareSize(alpha), style === "chunky" ? 4 : 3, `${style} square size`);
  }
});

test("solid looks are a silhouette with the two eyes cut out; neon is an outline with a faint inside and no cheek blocks", () => {
  const flat = trayMarkAlpha("flat");
  assert.ok(flat.every((value) => value === 0 || value === 255));
  assert.equal(holes(flat), 2);
  assert.equal(holes(trayMarkAlpha("chunky")), 2);
  for (const style of ["sticker", "mono", "fine"]) assert.deepEqual(trayMarkAlpha(style), flat, `${style} has no colours to tell it from flat in a one-colour template`);
  assert.notDeepEqual(trayMarkAlpha("chunky"), flat);
  const neon = trayMarkAlpha("neon");
  const solid = (alpha) => alpha.filter((value) => value === 255).length;
  const faint = neon.filter((value) => value > 0 && value < 255);
  assert.ok(faint.length > 0 && new Set(faint).size === 1);
  assert.ok(solid(neon) < solid(flat) / 2);
  assert.ok(PIXEL_GRIDS.M.cheeks.length > 0);
  for (const [x, y] of PIXEL_GRIDS.M.cheeks) assert.equal(neon[y * 3 * W + x * 3], faint[0], `the cheek square at ${x},${y} is not a solid block`);
});
