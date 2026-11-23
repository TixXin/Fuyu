import assert from "node:assert/strict";
import test from "node:test";
import { JELLY_LOOK_REST, dozeHour, lookToward, nextDozeChange, pokedMood } from "../../src/components/jellyfish/jellyLively.ts";
import { composePixelJellyfish } from "../../src/components/jellyfish/pixel/pixelCompose.ts";
import { PIXEL_GRIDS } from "../../src/components/jellyfish/pixel/pixelGrids.ts";
import { lookingPose, stillPose } from "../../src/components/jellyfish/pixel/pixelPoses.ts";
import { pixelTones } from "../../src/components/jellyfish/pixel/pixelTones.ts";
import { centerMoodChangesAt, centerMoodFor } from "../../src/features/center-pattern/centerSettings.ts";
import { petMoodOf } from "../../src/features/center-pattern/patterns.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";

const at = (hour, minute = 0) => new Date(2026, 10, 23, hour, minute).getTime();

test("the eyes rest while the pointer is over the jellyfish and turn one step towards it once it moves away", () => {
  assert.deepEqual(lookToward(0, 0, 30, 24), JELLY_LOOK_REST);
  assert.deepEqual(lookToward(17, -14, 30, 24), JELLY_LOOK_REST);
  assert.deepEqual(lookToward(200, 0, 30, 24), { x: 1, y: 0 });
  assert.deepEqual(lookToward(-19, 15, 30, 24), { x: -1, y: 1 });
  assert.deepEqual(lookToward(4, -300, 30, 24), { x: 0, y: -1 });
});

test("a poke cheers up an idle jellyfish and startles a sleeping one; one that is acting out an agent does not react", () => {
  assert.equal(pokedMood("idle"), "done");
  assert.equal(pokedMood("sleep"), "waiting");
  for (const mood of ["running", "waiting", "failed", "done", "stale", "compacting"]) assert.equal(pokedMood(mood), null, mood);
});

test("looking moves only the idle eyes, by one step, and never out of the body", () => {
  const tones = pixelTones("flat", [246, 227, 211], false, false);
  const eyes = (buffer) => {
    const found = [];
    for (let y = 0; y < buffer.height; y += 1) {
      for (let x = 0; x < buffer.width; x += 1) {
        const i = (y * buffer.width + x) * 4;
        if (buffer.data[i] === tones.ink[0] && buffer.data[i + 1] === tones.ink[1] && buffer.data[i + 2] === tones.ink[2] && buffer.data[i + 3] === 255) found.push([x, y]);
      }
    }
    return found;
  };
  const rest = stillPose("idle");
  assert.equal(lookingPose(rest, "idle", 0, 0), rest);
  assert.equal(lookingPose(stillPose("running"), "running", 1, 1).eyeDx, stillPose("running").eyeDx);
  for (const grid of Object.values(PIXEL_GRIDS)) {
    const before = eyes(composePixelJellyfish(grid, "flat", rest, tones));
    assert.ok(before.length > 0, grid.key);
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const after = eyes(composePixelJellyfish(grid, "flat", lookingPose(rest, "idle", x, y), tones));
      const moved = before.map(([px, py]) => [px + x * grid.step, py + y * grid.step]);
      assert.deepEqual(after, moved.sort((a, b) => a[1] - b[1] || a[0] - b[0]), `${grid.key} looking ${x},${y}`);
    }
  }
});

test("the night doze runs from 11 pm to 6 am in local time", () => {
  assert.deepEqual([22, 23, 0, 5, 6, 12].map(dozeHour), [false, true, true, true, false, false]);
  assert.equal(nextDozeChange(at(12)), at(23));
  assert.equal(nextDozeChange(at(22, 59)), at(23));
  assert.equal(nextDozeChange(at(23, 30)), at(6) + 24 * 3600_000);
  assert.equal(nextDozeChange(at(2)), at(6));
  assert.equal(nextDozeChange(at(6)), at(23));
});

test("the bar jellyfish dozes at night only when the setting is on and nothing is happening", () => {
  const night = at(1);
  const session = (phase, ago = 0) => ({ phase, updatedAt: night - ago });
  assert.equal(normalizeSettings({}).jellyfishNightDoze, false);
  assert.equal(normalizeSettings({ jellyfishNightDoze: true }).jellyfishNightDoze, true);
  assert.equal(normalizeSettings({ jellyfishNightDoze: "yes" }).jellyfishNightDoze, false);
  assert.equal(centerMoodFor([], night), "idle");
  assert.equal(centerMoodFor([], night, true), "sleep");
  assert.equal(centerMoodFor([], at(12), true), "idle");
  assert.equal(centerMoodFor([session("running")], night, true), "running");
  assert.equal(centerMoodFor([session("waiting")], night, true), "waiting");
  assert.equal(centerMoodFor([session("completed", 1000)], night, true), "done");
  assert.equal(petMoodOf("sleep"), "idle");
  assert.equal(centerMoodChangesAt([], night, false), null);
  assert.equal(centerMoodChangesAt([], night, true), at(6));
  assert.equal(centerMoodChangesAt([session("completed", 1000)], night, true) < at(6), true);
});
