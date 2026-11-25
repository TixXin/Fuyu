import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_ISLAND_PAGES,
  effectivePageDockZone,
  pageDockZone,
  pagesForDockZone,
  readIslandPages,
  setIslandPagePlacement,
} from "../../src/lib/settings/islandPages.ts";
import {
  DEFAULT_SIDE_DOCKS,
  applySideDockSplitPreset,
  handleRadiusFor,
  innerRadiusFor,
  normalizeSideDocks,
  readSideDocks,
  sideDockEnabledSides,
} from "../../src/lib/settings/sideDocks.ts";
import {
  sideDockWindowSize,
  stripWidthFor,
  targetVisualStateOnTrigger,
} from "../../src/windows/side-dock/dockGeometry.ts";
import {
  IDLE_SIDE_SWIPE,
  SIDE_SWIPE_THRESHOLD_PX,
  stepSideDockGesture,
} from "../../src/windows/side-dock/sideDockSwipe.ts";

describe("islandPages placement", () => {
  it("defaults missing or invalid placement to top and keeps v1 compatibility", () => {
    const parsed = readIslandPages(JSON.stringify({
      version: 1,
      order: ["todo", "music"],
      hidden: [],
      placement: { todo: "right", music: "top", bad: "bottom", empty: 123 },
    }));
    assert.deepEqual(parsed.placement, { todo: "right" });
    assert.equal(pageDockZone(parsed, "todo"), "right");
    assert.equal(pageDockZone(parsed, "music"), "top");
  });

  it("falls back to top when assigned side dock is disabled", () => {
    const layout = setIslandPagePlacement(EMPTY_ISLAND_PAGES, "todo", "right");
    assert.equal(effectivePageDockZone(layout, "todo", { left: false, right: false }), "top");
    assert.equal(effectivePageDockZone(layout, "todo", { left: false, right: true }), "right");

    const items = [{ id: "agents" }, { id: "todo" }, { id: "clipboard" }];
    const withRightOff = pagesForDockZone(items, layout, "top", { left: false, right: false });
    assert.deepEqual(withRightOff.map((i) => i.id), ["agents", "todo", "clipboard"]);

    const withRightOn = pagesForDockZone(items, layout, "top", { left: false, right: true });
    assert.deepEqual(withRightOn.map((i) => i.id), ["agents", "clipboard"]);
    const onRight = pagesForDockZone(items, layout, "right", { left: false, right: true });
    assert.deepEqual(onRight.map((i) => i.id), ["todo"]);
  });

  it("removes placement map when all pages return to top", () => {
    const moved = setIslandPagePlacement(EMPTY_ISLAND_PAGES, "todo", "left");
    const restored = setIslandPagePlacement(moved, "todo", "top");
    assert.equal(restored.placement, undefined);
  });
});

describe("sideDocks settings", () => {
  it("uses lower default radius, auto-expand drawer, follow-island appearance, and disabled edges by default", () => {
    assert.equal(DEFAULT_SIDE_DOCKS.outerRadius, 14);
    assert.equal(innerRadiusFor(14), 8);
    assert.equal(handleRadiusFor(14), 7);
    assert.equal(DEFAULT_SIDE_DOCKS.autoDrawer, "auto");
    assert.equal(DEFAULT_SIDE_DOCKS.appearance, "follow");
    assert.equal(DEFAULT_SIDE_DOCKS.left.enabled, false);
    assert.equal(DEFAULT_SIDE_DOCKS.right.enabled, false);

    const migrated = normalizeSideDocks({ theme: "light", material: "solid" });
    assert.equal(migrated.appearance, "custom");
    assert.equal(migrated.theme, "light");
    assert.equal(migrated.material, "solid");
  });

  it("clamps out-of-range geometry and ignores invalid enum values", () => {
    const normalized = normalizeSideDocks({
      left: { enabled: true, along: 0.01, pinned: true, lastPage: "shelf" },
      right: { enabled: false, along: 0.99 },
      stages: 99,
      autoDrawer: "unknown",
      outerRadius: 40,
      drawerWidth: 999,
      drawerHeight: 100,
      hoverDelayMs: -50,
      quickStripItems: ["a", "a", "b", "c", "d", "e", "f"],
    });
    assert.equal(normalized.left.along, 0.14);
    assert.equal(normalized.right.along, 0.86);
    assert.equal(normalized.stages, 3);
    assert.equal(normalized.autoDrawer, "auto");
    assert.equal(normalized.outerRadius, 22);
    assert.equal(normalized.drawerWidth, 520);
    assert.equal(normalized.drawerHeight, 400);
    assert.equal(normalized.hoverDelayMs, 0);
    assert.deepEqual(normalized.quickStripItems, ["a", "b", "c", "d", "e"]);
  });

  it("falls back to defaults on invalid JSON or mismatched version", () => {
    assert.deepEqual(readSideDocks("{bad"), DEFAULT_SIDE_DOCKS);
    assert.deepEqual(readSideDocks(JSON.stringify({ version: 2, outerRadius: 8 })), DEFAULT_SIDE_DOCKS);
  });

  it("yields the matching side dock when main island is docked on the same side", () => {
    const both = normalizeSideDocks({ left: { enabled: true }, right: { enabled: true } });
    assert.deepEqual(sideDockEnabledSides(both, null), { left: true, right: true });
    assert.deepEqual(sideDockEnabledSides(both, "right"), { left: true, right: false });
    assert.deepEqual(sideDockEnabledSides(both, "left"), { left: false, right: true });
  });

  it("balances split preset across left, top, and right based on semantics and active pages", () => {
    const allPages = [
      "fuyu", "agents", "music", "calendar", "timer",
      "weather", "sysmon", "countdown", "worldclock",
      "qq", "translation", "todo", "clipboard", "shelf",
    ];
    const { settings, layout } = applySideDockSplitPreset(DEFAULT_SIDE_DOCKS, EMPTY_ISLAND_PAGES, { pageIds: allPages });
    assert.equal(settings.left.enabled, true);
    assert.equal(settings.right.enabled, true);
    assert.equal(pageDockZone(layout, "fuyu"), "top");
    assert.equal(pageDockZone(layout, "agents"), "top");
    assert.equal(pageDockZone(layout, "music"), "top");
    assert.equal(pageDockZone(layout, "timer"), "top");
    assert.equal(pageDockZone(layout, "todo"), "right");
    assert.equal(pageDockZone(layout, "clipboard"), "right");
    assert.equal(pageDockZone(layout, "shelf"), "right");
    assert.equal(pageDockZone(layout, "calendar"), "left");
    assert.equal(pageDockZone(layout, "qq"), "left");

    const leftCount = allPages.filter((id) => pageDockZone(layout, id) === "left").length;
    const rightCount = allPages.filter((id) => pageDockZone(layout, id) === "right").length;
    assert.ok(leftCount >= 4 && rightCount >= 4, `expected balanced sides, got left=${leftCount}, right=${rightCount}`);
    assert.ok(Math.abs(leftCount - rightCount) <= 2);

    const leftOnlyBase = normalizeSideDocks({ left: { enabled: true }, right: { enabled: false } });
    const leftOnly = applySideDockSplitPreset(leftOnlyBase, EMPTY_ISLAND_PAGES, {
      pageIds: ["fuyu", "agents", "music", "todo", "clipboard", "shelf"],
    });
    assert.equal(leftOnly.settings.left.enabled, true);
    assert.equal(leftOnly.settings.right.enabled, false);
    assert.equal(pageDockZone(leftOnly.layout, "todo"), "left");
    assert.equal(pageDockZone(leftOnly.layout, "clipboard"), "left");
    assert.equal(pageDockZone(leftOnly.layout, "shelf"), "left");

    const bothSmallBase = normalizeSideDocks({ left: { enabled: true }, right: { enabled: true } });
    const bothSmall = applySideDockSplitPreset(bothSmallBase, EMPTY_ISLAND_PAGES, {
      pageIds: ["fuyu", "agents", "todo", "clipboard", "shelf"],
    });
    const smallLeft = ["todo", "clipboard", "shelf"].filter((id) => pageDockZone(bothSmall.layout, id) === "left").length;
    const smallRight = ["todo", "clipboard", "shelf"].filter((id) => pageDockZone(bothSmall.layout, id) === "right").length;
    assert.ok(smallLeft >= 1 && smallRight >= 1);
  });

  it("computes window sizes and auto-expand trigger target across 2-stage and 3-stage modes", () => {
    assert.equal(targetVisualStateOnTrigger({ stages: 3, autoDrawer: "auto" }), "drawer");
    assert.equal(targetVisualStateOnTrigger({ stages: 3, autoDrawer: "hover-item" }), "strip");
    assert.equal(targetVisualStateOnTrigger({ stages: 3, autoDrawer: "hover-item" }, 0), "drawer");
    assert.equal(targetVisualStateOnTrigger({ stages: 2, autoDrawer: "click" }), "drawer");

    assert.equal(stripWidthFor({ stripStyle: "label" }), 66);
    assert.equal(stripWidthFor({ stripStyle: "icon" }), 52);
    assert.equal(stripWidthFor({ stripStyle: "label", density: "compact" }), 58);
    assert.equal(stripWidthFor({ stripStyle: "icon", density: "compact" }), 46);

    const handleSize = sideDockWindowSize(DEFAULT_SIDE_DOCKS, "handle");
    assert.deepEqual(handleSize, { width: 23, height: 108 });

    const drawerThree = sideDockWindowSize(DEFAULT_SIDE_DOCKS, "drawer", 3);
    const drawerTwo = sideDockWindowSize({ ...DEFAULT_SIDE_DOCKS, stages: 2 }, "drawer", 3);
    const drawerEmpty = sideDockWindowSize(DEFAULT_SIDE_DOCKS, "drawer", 0);
    assert.equal(drawerThree.width - drawerTwo.width, 66 + DEFAULT_SIDE_DOCKS.gap);
    assert.equal(drawerEmpty.width, drawerTwo.width);
  });

  it("fires exactly once across a long macOS momentum swipe tail and supports repeated forward and gentle reverse swipes", () => {
    let state = IDLE_SIDE_SWIPE;
    const turns = [];
    const momentumTail = [24, 42, 48, 36, 26, 18, 12, 6, 2, 1, 3, 5, 2, 1, 2, 4, 2, 1];
    let t = 1000;
    for (const dx of momentumTail) {
      const res = stepSideDockGesture(state, dx, 2, t, SIDE_SWIPE_THRESHOLD_PX, true);
      state = res.state;
      if (res.turn !== null) turns.push(res.turn);
      t += 16;
    }
    assert.deepEqual(turns, [1]);

    for (let i = 0; i < 6; i += 1) {
      const res = stepSideDockGesture(state, 0, 20, t, SIDE_SWIPE_THRESHOLD_PX, true);
      state = res.state;
      t += 16;
    }

    t += 150;
    for (const dx of [38, 40]) {
      const res = stepSideDockGesture(state, dx, 0, t, SIDE_SWIPE_THRESHOLD_PX, true);
      state = res.state;
      if (res.turn !== null) turns.push(res.turn);
      t += 16;
    }
    assert.deepEqual(turns, [1, 1]);

    t += 120;
    for (let i = 0; i < 12; i += 1) {
      const res = stepSideDockGesture(state, -7, 0, t, SIDE_SWIPE_THRESHOLD_PX, true);
      state = res.state;
      if (res.turn !== null) turns.push(res.turn);
      t += 16;
    }
    assert.deepEqual(turns, [1, 1, -1]);

    t += 150;
    for (const dx of [-40, -40]) {
      const res = stepSideDockGesture(state, dx, 0, t, SIDE_SWIPE_THRESHOLD_PX, true);
      state = res.state;
      if (res.turn !== null) turns.push(res.turn);
      t += 16;
    }
    assert.deepEqual(turns, [1, 1, -1, -1]);
  });
});
