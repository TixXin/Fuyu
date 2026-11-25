import assert from "node:assert/strict";
import test from "node:test";
import { anchorRestoreTarget, groupDirectorScenes, resolveDirectorScenes } from "../../src/windows/onboarding/directorScenes.ts";
import { clampIndex, resolveExtensions, resolveMainSteps, resolveSetupSteps, resolveWhatsNewSteps } from "../../src/windows/onboarding/flow.ts";
import { isNewerGuideVersion, parseDirectorCommand } from "../../src/windows/onboarding/storage.ts";

const sampleBundle = {
  id: "pomodoro-flow",
  displayName: { "zh-CN": "番茄工作法", en: "Pomodoro flow" },
  description: { "zh-CN": "番茄钟和进度环", en: "Timer and ring" },
  members: [{ name: "@fuyu/pomodoro", displayName: { "zh-CN": "番茄钟", en: "Pomodoro" } }],
};

test("main flow stays concise on Windows even when agents and a bundle are available", () => {
  const steps = resolveMainSteps({
    isMacOS: false,
    modules: new Set(["todo", "music", "agents", "shelf", "clipboard", "mail"]),
    permissionKinds: [],
    bundle: sampleBundle,
  });
  assert.deepEqual(
    steps.map((step) => step.id),
    ["hello", "shape", "outfit", "play", "release"],
  );
  assert.equal(steps[0].autoDirector, true);
});

test("macOS permissions always come before the hands-on practice step", () => {
  const steps = resolveMainSteps({
    isMacOS: true,
    modules: new Set(["clipboard", "screenshot"]),
    permissionKinds: ["accessibility", "screenRecording"],
    bundle: null,
  });
  const ids = steps.map((step) => step.id);
  assert.ok(ids.includes("permissions"));
  assert.ok(ids.indexOf("permissions") < ids.indexOf("play"));
  assert.equal(steps.find((step) => step.id === "permissions")?.spotlight, "off");
});

test("macOS skips permissions when no selected module requires system permissions", () => {
  const steps = resolveMainSteps({
    isMacOS: true,
    modules: new Set(["music", "shelf"]),
    permissionKinds: [],
    bundle: null,
  });
  assert.equal(steps.some((step) => step.id === "permissions"), false);
});

test("whats-new track stays independent from first-run steps", () => {
  const steps = resolveWhatsNewSteps({
    isMacOS: true,
    modules: new Set(["agents"]),
    permissionKinds: [],
    bundle: null,
  });
  assert.deepEqual(steps.map((step) => step.id), ["whatsNewNotes", "whatsNewForms"]);
});

test("optional extensions and agent setup track adapt to enabled modules and bundle availability", () => {
  const full = {
    isMacOS: false,
    modules: new Set(["agents", "mail"]),
    permissionKinds: [],
    bundle: sampleBundle,
  };
  assert.deepEqual(resolveExtensions(full).map((ext) => ext.id), ["agentSetup", "bundle", "mail"]);
  assert.deepEqual(resolveSetupSteps(full).map((step) => step.id), ["agentCards", "agentConnect", "push"]);
  assert.ok(resolveSetupSteps(full).every((step) => step.layout === "wide" && step.spotlight === "off"));

  const minimal = {
    isMacOS: false,
    modules: new Set(["music"]),
    permissionKinds: [],
    bundle: null,
  };
  assert.deepEqual(resolveExtensions(minimal), []);
  assert.deepEqual(resolveSetupSteps(minimal), []);
});

test("director command parser validates action payloads, nonce and expiry", () => {
  const now = 2_000_000;
  assert.deepEqual(
    parseDirectorCommand(JSON.stringify({ action: "expand", page: "agents", requestedAt: now - 100, nonce: 3 }), now),
    { action: "expand", page: "agents", requestedAt: now - 100, nonce: 3 },
  );
  assert.deepEqual(
    parseDirectorCommand(JSON.stringify({ action: "tuck", requestedAt: now - 50 }), now),
    { action: "tuck", requestedAt: now - 50, nonce: 0 },
  );
  assert.equal(parseDirectorCommand(JSON.stringify({ action: "tuck", requestedAt: now - 8_000 }), now), null);
  assert.equal(parseDirectorCommand(JSON.stringify({ action: "unknown", requestedAt: now }), now), null);
});

test("isNewerGuideVersion compares stable and beta versions accurately", () => {
  assert.equal(isNewerGuideVersion("0.3.15", "0.3.14"), true);
  assert.equal(isNewerGuideVersion("0.3.14", "0.3.14-beta.2"), true);
  assert.equal(isNewerGuideVersion("0.3.14-beta.3", "0.3.14-beta.2"), true);
  assert.equal(isNewerGuideVersion("0.3.14", "0.3.14"), false);
  assert.equal(isNewerGuideVersion("0.3.13", "0.3.14"), false);
  assert.equal(isNewerGuideVersion("bad", "0.3.14"), false);
});

test("clampIndex stays in range for empty and non-empty step lists", () => {
  assert.equal(clampIndex(3, 0), 0);
  assert.equal(clampIndex(-2, 5), 0);
  assert.equal(clampIndex(9, 5), 4);
  assert.equal(clampIndex(2, 5), 2);
});

test("resolveDirectorScenes filters taskbar and agent scenes by environment and capabilities", () => {
  const full = resolveDirectorScenes({ agentsEnabled: true, taskbarAvailable: true });
  assert.ok(full.some((scene) => scene.id === "dockTaskbar"));
  assert.ok(full.some((scene) => scene.id === "agentApproval"));
  assert.ok(full.some((scene) => scene.id === "agentStack"));
  assert.ok(full.some((scene) => scene.id === "sideSplit"));
  assert.ok(full.some((scene) => scene.id === "sideRight"));
  assert.ok(full.some((scene) => scene.id === "sideLeft"));
  assert.deepEqual(groupDirectorScenes(full).map((entry) => entry.group), ["forms", "agents", "panels"]);

  const noTaskbarNoAgents = resolveDirectorScenes({ agentsEnabled: false, taskbarAvailable: false });
  assert.equal(noTaskbarNoAgents.some((scene) => scene.id === "dockTaskbar"), false);
  assert.equal(noTaskbarNoAgents.some((scene) => scene.group === "agents"), false);
  assert.equal(noTaskbarNoAgents.some((scene) => scene.id === "agents"), false);
  assert.deepEqual(groupDirectorScenes(noTaskbarNoAgents).map((entry) => entry.group), ["forms", "panels"]);
});

test("anchorRestoreTarget maps saved island form and edge back to top or dock target", () => {
  assert.deepEqual(anchorRestoreTarget({ islandForm: "pill", edge: "top", taskbarDocked: false }), { kind: "top", form: "pill" });
  assert.deepEqual(anchorRestoreTarget({ islandForm: "top", edge: "right", taskbarDocked: false }), { kind: "dock", target: "right" });
  assert.deepEqual(anchorRestoreTarget({ islandForm: "top", edge: "bottom", taskbarDocked: true }), { kind: "dock", target: "taskbar" });
  assert.deepEqual(anchorRestoreTarget({ islandForm: "top", edge: "bottom", taskbarDocked: false }), { kind: "dock", target: "bottom" });
});
