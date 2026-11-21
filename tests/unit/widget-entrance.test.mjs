import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_ENTRANCE_BAG, WIDGET_ENTRANCES, WIDGET_ENTRANCE_EFFECTS, drawEntrance } from "../../src/lib/theme/widgetEntrance.ts";
import { planEntrance } from "../../src/lib/theme/widgetEntrancePlan.ts";
import { countText } from "../../src/windows/island/custom-panels/entrance/entranceData.ts";
import { normalizeSettings } from "../../src/lib/settings/settings.ts";

function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function sceneOf(count) {
  const step = 82;
  const cards = Array.from({ length: count }, (_, at) => ({ left: Math.floor(at / 2) * step, top: (at % 2) * step, width: 76, height: 76 }));
  return { cards, origin: { x: 280, y: -44 }, mascot: { card: 0, x: 38, y: 45 }, width: 560, height: 158, step, accents: ["#f0a04b", "#5eead4", "#ff5f9e"] };
}

test("new installs shuffle the widget entrance and play the data motion; unknown values fall back to them", () => {
  assert.equal(normalizeSettings({}).widgetEntrance, "shuffle");
  assert.equal(normalizeSettings({}).widgetDataMotion, true);
  assert.equal(normalizeSettings({ widgetEntrance: "spin" }).widgetEntrance, "shuffle");
  assert.equal(normalizeSettings({ widgetDataMotion: "yes" }).widgetDataMotion, true);
  for (const entrance of WIDGET_ENTRANCES) assert.equal(normalizeSettings({ widgetEntrance: entrance }).widgetEntrance, entrance);
  assert.equal(normalizeSettings({ widgetDataMotion: false }).widgetDataMotion, false);
});

test("shuffle never plays the same entrance twice in a row and goes through every effect before repeating one", () => {
  for (const seed of [1, 7, 42, 2026]) {
    const random = seeded(seed);
    let bag = EMPTY_ENTRANCE_BAG;
    const drawn = [];
    for (let at = 0; at < WIDGET_ENTRANCE_EFFECTS.length * 6; at += 1) {
      const next = drawEntrance(bag, random);
      drawn.push(next.effect);
      bag = next.bag;
    }
    drawn.forEach((effect, at) => assert.notEqual(effect, drawn[at - 1], `seed ${seed}, draw ${at}`));
    for (let round = 0; round < 6; round += 1) {
      const lap = drawn.slice(round * WIDGET_ENTRANCE_EFFECTS.length, (round + 1) * WIDGET_ENTRANCE_EFFECTS.length);
      assert.deepEqual([...lap].sort(), [...WIDGET_ENTRANCE_EFFECTS].sort(), `seed ${seed}, round ${round}`);
    }
    assert.ok(!drawn.includes("shuffle") && !drawn.includes("fade"));
  }
});

test("every entrance shows each card's content before the island has finished opening, however many cards there are", () => {
  for (const effect of WIDGET_ENTRANCE_EFFECTS) {
    for (const count of [1, 3, 9, 30]) {
      const plan = planEntrance(effect, sceneOf(count));
      assert.equal(plan.ready.length, count);
      for (const ready of plan.ready) assert.ok(ready >= 0 && ready <= 560, `${effect} with ${count} cards: ${ready}`);
      assert.ok(plan.total <= 1600, `${effect} with ${count} cards runs ${plan.total}ms`);
      for (const step of plan.steps) assert.ok((step.part === "board" || (step.card >= 0 && step.card < count)) && step.duration > 0 && step.delay >= 0, `${effect} step`);
    }
    assert.deepEqual(planEntrance(effect, sceneOf(0)), { steps: [], ready: [], total: 0 });
  }
});

test("only the focus pull and the flip move or blur a card's text; every other entrance fades it", () => {
  for (const effect of WIDGET_ENTRANCE_EFFECTS) {
    const keys = new Set(planEntrance(effect, sceneOf(9)).steps.filter((step) => step.part === "cell").flatMap((step) => step.frames.flatMap((frame) => Object.keys(frame))));
    keys.delete("offset");
    keys.delete("opacity");
    if (effect === "focus" || effect === "flip") assert.ok(keys.size > 0, effect);
    else assert.deepEqual([...keys], [], effect);
  }
});

test("a counting number keeps its digit count and ends on the real value", () => {
  for (const target of ["88%", "128", "77天", " 42 kB/s", "7"]) {
    const digits = /\d+/.exec(target)[0].length;
    for (let at = 0; at <= 20; at += 1) {
      const shown = countText(target, at / 20);
      assert.equal(shown.length, target.length, `${target} at ${at}`);
      assert.equal(/\d+/.exec(shown)[0].length, digits, `${target} at ${at}`);
    }
    assert.equal(countText(target, 1), target);
    assert.equal(countText(target, 4), target);
  }
  for (const still of ["3.5 MB", "—", "25:00", "10", "0"]) assert.equal(countText(still, 0), still, still);
});
