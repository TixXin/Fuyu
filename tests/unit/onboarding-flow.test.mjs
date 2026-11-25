import assert from "node:assert/strict";
import test from "node:test";
import { clampIndex, resolveExtensions, resolveMainSteps, resolveSetupSteps } from "../../src/windows/onboarding/flow.ts";

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

test("clampIndex stays in range for empty and non-empty step lists", () => {
  assert.equal(clampIndex(3, 0), 0);
  assert.equal(clampIndex(-2, 5), 0);
  assert.equal(clampIndex(9, 5), 4);
  assert.equal(clampIndex(2, 5), 2);
});
