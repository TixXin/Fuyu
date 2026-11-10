import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as storage from "../../src/features/updater/storage.ts";
import { nextUpdateCheckAt } from "../../src/features/updater/checkSchedule.ts";
import { isNativeError } from "../../src/i18n/nativeError.ts";

const transpile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const source = transpile("../../src/features/updater/updaterController.ts");
const apiSource = transpile("../../src/features/updater/api.ts");

export function runtime({ check = async () => null, install = async () => {}, notify = async () => true, preferences = {} } = {}) {
  const subscribers = new Set();
  const windows = new Set();
  let prefs = storage.normalizeUpdatePreferences(preferences);
  let channel = null;
  let snapshot = {
    revision: 0, stage: "idle", channel: null, nextVersion: "", notes: "", downloaded: 0, total: 0,
    detail: "", lastCheckedAt: null, lastAttemptAt: null, startedAt: Date.now() - 30_000, checkFailures: 0,
  };
  const calls = [];
  const emit = (patch) => {
    snapshot = { ...snapshot, ...patch, revision: snapshot.revision + 1 };
    for (const fn of subscribers) fn({ payload: { ...snapshot } });
  };
  const sync = () => { for (const fn of windows) fn({ key: storage.UPDATE_PREFERENCES_KEY }); };
  const native = async (command, args) => {
    calls.push({ command, args });
    if (command === "updater_state") return { ...snapshot };
    if (command === "updater_notify") return notify(args);
    if (command === "updater_check") {
      if (["checking", "downloading", "installing"].includes(snapshot.stage)) throw { code: "updater.busy", message: "busy" };
      emit({ stage: "checking", lastAttemptAt: Date.now() });
      try {
        const found = await check(args);
        emit({ stage: found ? "available" : "latest", nextVersion: found?.version ?? "", notes: found?.body ?? "",
          channel: args.channel, lastCheckedAt: Date.now(), checkFailures: 0, detail: "" });
        return found;
      } catch (error) {
        emit({ stage: "error", checkFailures: snapshot.checkFailures + 1, detail: String(error) });
        throw error;
      }
    }
    if (command === "updater_install") {
      if (args.expectedVersion !== snapshot.nextVersion || args.expectedChannel !== snapshot.channel) {
        throw { code: "updater.targetChanged", message: "target changed" };
      }
      emit({ stage: "downloading", downloaded: 0, total: 0 });
      try { await install(emit); emit({ stage: "done" }); }
      catch (error) { emit({ stage: "error", detail: String(error) }); throw error; }
      return;
    }
    throw new Error(`Unexpected command ${command}`);
  };
  async function controller({ configured = true, version = "0.3.5", proxy = null, query = null } = {}) {
    const exports = {};
    const handlers = new Map();
    const mocks = {
      "@tauri-apps/api/app": { getVersion: async () => version },
      "@tauri-apps/api/core": { Channel: class {}, isTauri: () => true, invoke: async (command, args) => {
        if (command === "updater_configured") return configured;
        if (command === "get_updater_proxy") return proxy;
        if (command === "updater_state" && query) return query({ ...snapshot });
        return native(command, args);
      } },
      "@tauri-apps/api/event": { listen: async (event, fn) => {
        assert.equal(event, "updater-state-changed");
        subscribers.add(fn); return () => subscribers.delete(fn);
      } },
      "./storage": { ...storage,
        loadUpdateChannel: (current) => storage.normalizeUpdateChannel(channel, current),
        saveUpdateChannel: (next) => { channel = next; sync(); },
        loadUpdatePreferences: () => prefs,
        saveUpdatePreferences: (patch) => { prefs = { ...prefs, ...patch }; sync(); return prefs; },
      },
      "./checkSchedule": { nextUpdateCheckAt },
      "../../i18n/nativeError.ts": { isNativeError },
    };
    const api = {};
    runInNewContext(apiSource, { exports: api, require: (name) => mocks[name] });
    mocks["./api"] = api;
    runInNewContext(source, {
      exports, require: (name) => { assert.ok(mocks[name], name); return mocks[name]; },
      console: { error() {} }, window: {
        addEventListener: (name, fn) => { handlers.set(name, fn); if (name === "storage") windows.add(fn); },
        removeEventListener: (name, fn) => { handlers.delete(name); if (name === "storage") windows.delete(fn); },
      },
    });
    await new Promise(setImmediate);
    return Object.assign(exports, { close: () => handlers.get("pagehide")?.() });
  }
  return { controller, emit, calls, prefs: () => prefs, snapshot: () => ({ ...snapshot }),
    changePrefs: (patch) => { prefs = { ...prefs, ...patch }; sync(); }, listenerCount: () => subscribers.size };
}
