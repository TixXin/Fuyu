import assert from "node:assert/strict";
import test from "node:test";
import { allowFromValid, chatLabel, freeProjectName } from "../../src/features/cc-connect/api.ts";
import { chosenProjects, planProjects, readyTargets } from "../../src/windows/onboarding/push/plan.ts";

test("a new bot's project takes the first free name", () => {
  assert.equal(freeProjectName([]), "phone");
  assert.equal(freeProjectName(["phone", "phone-2", "work"]), "phone-3");
  assert.equal(freeProjectName(["bot"], "bot"), "bot-2");
});

test("who may use a bot is named, never everyone", () => {
  assert.equal(allowFromValid("123456"), true);
  assert.equal(allowFromValid("123, ou_abc-1"), true);
  for (const open of ["", " ", "*", "1,*", "1,,2", "a b"]) assert.equal(allowFromValid(open), false, open);
});

test("a chat shows its platform and user", () => {
  const chat = { key: "telegram:1:1", platform: "telegram", userName: "ada" };
  assert.equal(chatLabel(chat, { telegram: "Telegram" }), "Telegram · ada");
  assert.equal(chatLabel({ ...chat, platform: "matrix", userName: null }, {}), "matrix");
});

test("onboarding push plans projects for this computer once cc-connect is installed", () => {
  const local = { id: "local", label: null, slug: "local", remote: false };
  const missing = [{ target: local, state: { installed: false, running: false, agents: ["claudecode", "codex"], projects: [], taken: [] } }];
  assert.deepEqual(readyTargets(missing), []);
  const installed = [{ target: local, state: { installed: true, running: false, agents: ["claudecode", "codex"], projects: [], taken: ["local-codex"] } }];
  const planned = planProjects(installed, []);
  assert.deepEqual(planned.map((item) => item.name), ["local-claudecode", "local-codex"]);
  assert.deepEqual(chosenProjects(planned, installed, new Set()).map((item) => item.name), ["local-claudecode"]);
  assert.deepEqual(chosenProjects(planned, installed, new Set(), "local/codex").map((item) => item.name), ["local-claudecode", "local-codex"]);
});
