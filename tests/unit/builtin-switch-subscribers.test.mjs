import assert from "node:assert/strict";
import { test } from "node:test";

const plugins = [
  { id: "session-ring", kind: "builtin", enabled: false, background: [], config: { style: "signal", showCount: false } },
  { id: "agents", kind: "builtin", enabled: true, background: [], config: {} },
];
const calls = [];
globalThis.window = {
  __TAURI_INTERNALS__: {
    transformCallback: () => 1,
    invoke: async (cmd, args) => {
      calls.push([cmd, args]);
      if (cmd === "get_builtin_plugins") return plugins;
      if (cmd === "set_builtin_plugin_enabled") throw new Error("nothing here may switch a plugin");
      return 1;
    },
  },
};

const { disabledBuiltinIds, subscribeBuiltinPlugins } = await import("../../src/features/plugin-kernel/builtinSwitches.ts");

async function until(check, ms = 2000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline && !check()) await new Promise((resolve) => setTimeout(resolve, 10));
  return check();
}

test("a registry that subscribes after the switches loaded still hides the plugins that are off", async () => {
  const first = [];
  subscribeBuiltinPlugins((list) => first.push(disabledBuiltinIds(list)));
  assert.ok(await until(() => first.length > 0), "the first subscriber never heard the switches");
  assert.deepEqual(first.at(-1), ["session-ring"]);

  const late = [];
  subscribeBuiltinPlugins((list) => late.push(disabledBuiltinIds(list)));
  assert.ok(await until(() => late.length > 0), "a subscriber that comes after loading never hears that session-ring is off");
  assert.deepEqual(late[0], ["session-ring"]);
  assert.equal(calls.filter(([cmd]) => cmd === "set_builtin_plugin_enabled").length, 0);
});
