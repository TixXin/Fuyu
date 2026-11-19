import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import { commandsV1, pluginConfigV1 } from "@fuyu/plugin-services";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import "../../src/windows/settings/PluginPage.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import type { InstalledEntry } from "../../src/windows/settings/pluginEntries";
import manifest from "../../plugins/v3/official/todo-digest/package.json";
import icon from "../../plugins/v3/official/todo-digest/assets/icon.svg";
import data from "./shot-data.json";

type Report = { state: "pending" } | { state: "failed"; error: string } | { state: "ready"; rect: { x: number; y: number; width: number; height: number } };
const report = (value: Report) => Object.assign(window, { __shot: value });
report({ state: "pending" });

const LOCALE = "zh-CN";
const view = new URLSearchParams(location.search).get("view") === "dialog" ? "dialog" : "preview";
const fixed = new Date(data.now).getTime();
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) super(fixed);
    else super(...(args as [number]));
  }
  static now() {
    return fixed;
  }
} as DateConstructor;
Object.defineProperty(navigator, "language", { configurable: true, get: () => LOCALE });
Object.defineProperty(navigator, "languages", { configurable: true, get: () => [LOCALE] });
localStorage.setItem(LOCALE_STORAGE_KEY, LOCALE);
Object.assign(globalThis, { isTauri: true });
mockIPC((command) => {
  if (command === "get_platform_support") return { os: "macos", unsupported: [], devBuild: false };
  return null;
});

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

async function settle(root: Element) {
  let last = root.innerHTML;
  let since = performance.now();
  const started = since;
  for (;;) {
    await sleep(50);
    const now = performance.now();
    const html = root.innerHTML;
    if (html !== last) {
      last = html;
      since = now;
    } else if (now - since >= 400) return;
    if (now - started > 8000) throw new Error("the page kept changing for 8 seconds");
  }
}

async function main() {
  const { windowServices } = await import("../../src/features/plugin-kernel/services");
  const { windowSlots } = await import("../../src/features/plugin-kernel/slots");
  const { PluginDetailModal } = await import("../../src/windows/settings/PluginDetailModal");
  const { default: applySettings } = await import("../../plugins/v3/official/todo-digest/src/settings.tsx");

  windowServices.provide(pluginConfigV1, {
    list: () => ({ items: [] }),
    get: ({ id }) => ({ id, schema: null, values: {}, defaults: {} }),
    set: ({ id }) => ({ id, schema: null, values: {}, defaults: {} }),
    reset: ({ id }) => ({ id, schema: null, values: {}, defaults: {} }),
  });
  windowServices.provide(commandsV1, {
    list: () => ({ items: [] }),
    run: () => null,
    setKeybinding: () => ({ items: [] }),
  });

  const id = manifest.name;
  const registry = windowSlots("settings");
  const unanswered: string[] = [];
  const ctx = {
    slots: {
      add(name: string, item: { id: string; category: string; component: ComponentType }) {
        if (name !== "settings.section/v1") throw new Error(`unexpected slot ${name}`);
        return registry.add("settings.section/v1", item, id, { external: true });
      },
    },
    host: {
      call(method: string) {
        if (method === "state") return Promise.resolve(data.todoDigest.state);
        unanswered.push(method);
        return Promise.reject(new Error(`no sample answer for ${method}`));
      },
      on: () => async () => {},
    },
  };
  applySettings(ctx as unknown as Parameters<typeof applySettings>[0]);

  const entry: InstalledEntry = {
    id,
    title: manifest.fuyu.displayName[LOCALE],
    icons: [icon],
    plugin: { id, name: id, state: "running", kind: "third-party", source: "market" },
    description: manifest.fuyu.description[LOCALE],
    version: manifest.version,
    publisher: null,
    source: "official",
    managed: true,
    removable: true,
    enabled: true,
    status: { dot: "ok", label: null, note: null, attention: false },
    reach: null,
    marketVersion: null,
    settings: true,
    places: [],
  };

  const stage = document.getElementById("stage")!;
  const host = document.createElement("div");
  stage.append(host);
  createRoot(host).render(
    <StrictMode>
      <I18nProvider>
        <PluginDetailModal entry={entry} initialTab="settings" stale={false} onClose={() => undefined} onAction={() => undefined} onOpenShortcuts={() => undefined} />
      </I18nProvider>
    </StrictMode>,
  );

  const deadline = performance.now() + 10_000;
  while (!document.querySelector(".fuyu-todo-digest__block")) {
    if (performance.now() > deadline) throw new Error("the settings section did not show its preview");
    await sleep(50);
  }
  await document.fonts.ready;
  await settle(stage);
  if (unanswered.length) throw new Error(`host calls without an answer: ${unanswered.join(", ")}`);
  (document.activeElement as HTMLElement | null)?.blur();
  const dialog = document.querySelector<HTMLElement>(`[data-plugin-detail='${id}']`)!;
  const box = dialog.getBoundingClientRect();
  if (view === "dialog") return report({ state: "ready", rect: { x: box.x, y: box.y, width: box.width, height: box.height } });
  const body = dialog.querySelector<HTMLElement>(".plugin-dialog__body")!.getBoundingClientRect();
  const rows = [...dialog.querySelectorAll<HTMLElement>(".fuyu-todo-digest__row")].map((row) => row.getBoundingClientRect());
  if (rows.length < 2) throw new Error("the settings section has fewer rows than expected");
  const bottom = Math.round((rows[0].bottom + rows[1].top) / 2);
  report({ state: "ready", rect: { x: box.x + 1, y: body.y, width: box.width - 2, height: bottom - body.y } });
}

main().catch((error: unknown) => report({ state: "failed", error: error instanceof Error ? error.message : String(error) }));
