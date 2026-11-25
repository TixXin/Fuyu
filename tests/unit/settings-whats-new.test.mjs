import assert from "node:assert/strict";
import test from "node:test";
import {
  activeSinceVersions,
  activeWhatsNewPages,
  dismissAllWhatsNew,
  markWhatsNewPageVisited,
  NEXT_SINCE,
  normalizeWhatsNewState,
  reconcileWhatsNewState,
  replayWhatsNew,
  unreadWhatsNewPages,
} from "../../src/lib/settings/whatsNew.ts";

const ITEMS = [
  { page: "general", since: "0.3.14" },
  { page: "behaviorTuck", since: "0.3.14-beta.2" },
  { page: "themeStyle", since: "0.3.14-beta.1" },
  { page: "music", since: "0.3.13" },
  { page: "clipboard", since: "0.3.12" },
  { page: "shelf", since: "next" },
];

test("fresh installs start at the current version with no new badges, while upgrades start at 0.0.0", () => {
  assert.deepEqual(reconcileWhatsNewState(null, "0.3.14", false), {
    state: { seenVersion: "0.3.14", visitedPages: [] },
    changed: true,
  });
  assert.deepEqual(reconcileWhatsNewState(null, "0.3.14", true), {
    state: { seenVersion: "0.0.0", visitedPages: [] },
    changed: true,
  });
  assert.equal(reconcileWhatsNewState(null, "0.0.0-test", true), null);
});

test("downgrades and already-seen versions settle cleanly without leftover visited pages", () => {
  assert.deepEqual(reconcileWhatsNewState({ seenVersion: "0.4.0", visitedPages: ["general"] }, "0.3.14", true), {
    state: { seenVersion: "0.3.14", visitedPages: [] },
    changed: true,
  });
  assert.deepEqual(reconcileWhatsNewState({ seenVersion: "0.3.14", visitedPages: ["general"] }, "0.3.14", true), {
    state: { seenVersion: "0.3.14", visitedPages: [] },
    changed: true,
  });
  assert.deepEqual(reconcileWhatsNewState({ seenVersion: "0.3.13", visitedPages: ["general"] }, "0.3.14", true), {
    state: { seenVersion: "0.3.13", visitedPages: ["general"] },
    changed: false,
  });
});

test("upgrading caps badges to the latest two base releases and ignores unreleased next tags", () => {
  const fromOld = activeSinceVersions(ITEMS, "0.3.10", "0.3.14");
  assert.deepEqual([...fromOld].sort(), ["0.3.13", "0.3.14", "0.3.14-beta.1", "0.3.14-beta.2"]);
  assert.ok(!fromOld.has("0.3.12"));
  assert.ok(!fromOld.has("next"));

  const fromPrev = activeSinceVersions(ITEMS, "0.3.13", "0.3.14");
  assert.deepEqual([...fromPrev].sort(), ["0.3.14", "0.3.14-beta.1", "0.3.14-beta.2"]);
});

test("beta upgrades only show items added since the seen beta, and stable upgrades include beta items for stable users", () => {
  assert.deepEqual([...activeSinceVersions(ITEMS, "0.3.14-beta.1", "0.3.14-beta.2")], ["0.3.14-beta.2"]);
  assert.deepEqual([...activeSinceVersions(ITEMS, "0.3.14-beta.2", "0.3.14")], ["0.3.14"]);
  const betaOnly = [{ page: "themeStyle", since: "0.3.14-beta.1" }];
  assert.deepEqual([...activeSinceVersions(betaOnly, "0.3.14-beta.1", "0.3.14")], []);
  assert.deepEqual([...activeSinceVersions(betaOnly, "0.3.13", "0.3.14")], ["0.3.14-beta.1"]);
});

test("hidden or unavailable pages never produce unread dots, and visiting the last visible page advances seenVersion", () => {
  const active = activeSinceVersions(ITEMS, "0.3.13", "0.3.14");
  const visible = (page) => page !== "behaviorTuck";
  const visiblePages = activeWhatsNewPages(ITEMS, active, visible);
  assert.deepEqual([...visiblePages].sort(), ["general", "themeStyle"]);

  let state = { seenVersion: "0.3.13", visitedPages: [] };
  assert.deepEqual([...unreadWhatsNewPages(ITEMS, active, state.visitedPages, visible)].sort(), ["general", "themeStyle"]);

  state = markWhatsNewPageVisited(state, "general", visiblePages, "0.3.14");
  assert.deepEqual(state, { seenVersion: "0.3.13", visitedPages: ["general"] });
  assert.deepEqual([...unreadWhatsNewPages(ITEMS, active, state.visitedPages, visible)], ["themeStyle"]);

  state = markWhatsNewPageVisited(state, "themeStyle", visiblePages, "0.3.14");
  assert.deepEqual(state, { seenVersion: "0.3.14", visitedPages: [] });
  assert.deepEqual(dismissAllWhatsNew("v0.3.14"), { seenVersion: "0.3.14", visitedPages: [] });
});

test("corrupted storage falls back to null and deduplicates visited pages", () => {
  assert.equal(normalizeWhatsNewState(null), null);
  assert.equal(normalizeWhatsNewState({ seenVersion: "bad" }), null);
  assert.deepEqual(normalizeWhatsNewState({ seenVersion: "v0.3.13", visitedPages: ["general", "general", "", 1], seenNextPages: ["shelf", "shelf", ""] }), {
    seenVersion: "0.3.13",
    visitedPages: ["general"],
    seenNextPages: ["shelf"],
  });
});

test("dev builds surface since=\"next\" incrementally per page and replay resets all read progress", () => {
  const devItems = [
    { page: "general", since: NEXT_SINCE },
    { page: "appearance", since: NEXT_SINCE },
  ];
  const active = activeSinceVersions(devItems, "0.3.14-beta.1", "0.3.14-beta.1", { includeNext: true });
  assert.deepEqual([...active], [NEXT_SINCE]);

  let state = { seenVersion: "0.3.14-beta.1", visitedPages: [] };
  assert.deepEqual([...unreadWhatsNewPages(devItems, active, state.visitedPages, () => true, state.seenNextPages)].sort(), ["appearance", "general"]);

  const visibleActive = activeWhatsNewPages(devItems, active, () => true);
  state = markWhatsNewPageVisited(state, "general", visibleActive, "0.3.14-beta.1", { hasNextOnPage: true, visibleSemverPages: new Set() });
  assert.deepEqual(state, { seenVersion: "0.3.14-beta.1", visitedPages: [], seenNextPages: ["general"] });
  assert.deepEqual([...unreadWhatsNewPages(devItems, active, state.visitedPages, () => true, state.seenNextPages)], ["appearance"]);

  const dismissed = dismissAllWhatsNew("0.3.14-beta.1", ["general", "appearance"]);
  assert.deepEqual(dismissed, { seenVersion: "0.3.14-beta.1", visitedPages: [], seenNextPages: ["general", "appearance"] });
  assert.deepEqual([...unreadWhatsNewPages(devItems, active, dismissed.visitedPages, () => true, dismissed.seenNextPages)], []);

  const withAddedNext = [...devItems, { page: "behavior", since: NEXT_SINCE }];
  assert.deepEqual([...unreadWhatsNewPages(withAddedNext, active, dismissed.visitedPages, () => true, dismissed.seenNextPages)], ["behavior"]);

  const replayed = replayWhatsNew();
  assert.deepEqual(replayed, { seenVersion: "0.0.0", visitedPages: [] });
  assert.deepEqual([...unreadWhatsNewPages(devItems, active, replayed.visitedPages, () => true, replayed.seenNextPages)].sort(), ["appearance", "general"]);
});

test("per-item next keys light up newly added settings on an already-visited page and reset after a version bump", () => {
  const firstItem = { page: "themeStyle", since: NEXT_SINCE, key: "themeStyle\0字体\0字体大小" };
  const secondItem = { page: "themeStyle", since: NEXT_SINCE, key: "themeStyle\0字体\0本地字体" };
  const active = activeSinceVersions([firstItem, secondItem], "0.3.14-beta.1", "0.3.14-beta.1", { includeNext: true });

  let state = { seenVersion: "0.3.14-beta.1", visitedPages: [] };
  const visible = activeWhatsNewPages([firstItem], active, () => true);
  state = markWhatsNewPageVisited(state, "themeStyle", visible, "0.3.14-beta.1", {
    hasNextOnPage: true,
    nextKeysOnPage: [firstItem.key],
    visibleSemverPages: new Set(),
  });
  assert.deepEqual(state.seenNextKeys, [firstItem.key]);
  assert.deepEqual([...unreadWhatsNewPages([firstItem], active, state.visitedPages, () => true, state.seenNextPages, state.seenNextKeys)], []);
  assert.deepEqual([...unreadWhatsNewPages([firstItem, secondItem], active, state.visitedPages, () => true, state.seenNextPages, state.seenNextKeys)], ["themeStyle"]);

  const upgraded = reconcileWhatsNewState(state, "0.3.14-beta.2", true);
  assert.deepEqual(upgraded, {
    state: { seenVersion: "0.3.14-beta.1", visitedPages: [] },
    changed: true,
  });
});
