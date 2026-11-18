import { act, StrictMode, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "../../src/styles/tokens.css";
import { BUILTINS, FAKE, ledger, switchOff } from "./builtinsOffMocks";
import { ownersOfItems, residue, seenIn, walk, type Domains } from "./builtinsOffWalk";
import { classDomains, ipcDomains } from "../../src/features/plugin-kernel/featureDomains";
import { defineSlot } from "../../src/features/plugin-kernel/slots";
import { islandContributions, useIslandContributions } from "../../src/features/plugin-kernel/useIslandContributions";
import { IslandApp } from "../../src/windows/island/IslandApp";
import { SettingsWindow } from "../../src/windows/settings/SettingsWindow";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";

const query = new URLSearchParams(location.search);
const everyone = query.has("all");
const only = query.get("only")?.split(",").filter(Boolean) ?? null;
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const original = new Map(Object.entries(localStorage).filter(([key]) => key.startsWith("fuyu-")));
window.addEventListener("beforeunload", () => {
  for (const key of Object.keys(localStorage).filter((key) => key.startsWith("fuyu-"))) if (!original.has(key)) localStorage.removeItem(key);
  for (const [key, value] of original) localStorage.setItem(key, value);
});
for (const key of Object.keys(localStorage).filter((key) => key.startsWith("fuyu-"))) localStorage.removeItem(key);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
localStorage.setItem("fuyu-save-directory", "");
localStorage.setItem("fuyu-qq-notification-access-requested", "true");
localStorage.setItem("fuyu-timers", JSON.stringify([{ id: "lab-countdown", kind: "countdown", durationMs: 3_600_000, elapsedMs: 0, runningSince: Date.now(), alerted: false }]));

const apiSources = import.meta.glob<string>("/src/**/api.ts", { query: "?raw", import: "default", eager: true });
const cssSources = import.meta.glob<string>("/src/**/*.css", { query: "?raw", import: "default", eager: true });
const roots = BUILTINS.map(({ id, root }) => ({ id, root }));
const ipc = ipcDomains(apiSources, roots);
const domains: Domains = { classes: classDomains(cssSources, roots), commands: ipc.commands, events: ipc.events };
const LEAKY: Domains = {
  classes: new Map([["lab-leaky-badge", FAKE], ["lab-leaky-owned", FAKE]]),
  commands: new Map([["lab_leaky_poll", FAKE]]),
  events: new Map([["lab-leaky-changed", FAKE]]),
};

function LeakyOwned() {
  return <span className="lab-leaky-owned" />;
}

function LeftBehind() {
  useIslandContributions(FAKE, "lab-leaky", [{ kind: "hint", key: "lab-leaky" }]);
  useEffect(() => {
    const timer = setInterval(() => void invoke("lab_leaky_poll"), 40);
    const off = listen("lab-leaky-changed", () => undefined);
    return () => {
      clearInterval(timer);
      void off.then((unlisten) => unlisten());
    };
  }, []);
  return <span className="lab-leaky-badge" />;
}

let root: Root | null = null;
const mount = () => act(async () => {
  root = createRoot(document.getElementById("root")!);
  root.render(<StrictMode><I18nProvider><IslandApp /><SettingsWindow /></I18nProvider></StrictMode>);
});
const unmount = () => act(async () => {
  root?.unmount();
  root = null;
});
const pause = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

async function offPass(id: string, table: Domains, fake = false) {
  await switchOff([id], fake);
  await mount();
  const before = ledger.snapshot().calls;
  const places = await walk();
  await pause(150);
  const found = residue(id, places, table, ledger, before);
  for (const left of islandContributions.byOwner()[id] ?? []) found.push(`${id}: still contributes ${left.kind}${"item" in left ? ` ${left.item}` : "key" in left ? ` ${left.key}` : ""} to the island`);
  await unmount();
  await switchOff([], fake);
  return found;
}

const results = document.getElementById("results")!;
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};

try {
  const owners = ownersOfItems();
  await mount();
  const baseline = await walk();
  await unmount();
  check(baseline.size > 20 && [...baseline.keys()].some((label) => label.startsWith("island page")) && [...baseline.keys()].some((label) => label.startsWith("settings")), `The walk reaches the collapsed island, its pages and the settings pages (${baseline.size} places)`);
  check(seenIn(baseline, domains.classes, "timer").length > 0 && seenIn(baseline, domains.classes, "translation").length > 0, "With everything on, the walk sees the timer's and the translation's own classes");

  const unregister = [
    defineSlot("island.dev/v1").add({ id: "lab-leaky", component: LeakyOwned }, FAKE),
    defineSlot("island.dev/v1").add({ id: "lab-leaky-left", component: LeftBehind }),
  ];
  const leaky = await offPass(FAKE, LEAKY, true);
  unregister.forEach((dispose) => dispose());
  check(leaky.some((line) => line.includes(".lab-leaky-badge")) && leaky.every((line) => !line.includes("lab-leaky-owned") && !line.includes("still shows")), "The check sees a class left on screen, and not the item that went away with its owner");
  check(leaky.some((line) => line.includes("called lab_leaky_poll")) && leaky.some((line) => line.includes("still listens to lab-leaky-changed")), "The check sees a command still called and a listener still alive");
  check(leaky.some((line) => line.includes("still contributes hint lab-leaky")), "The check sees a contribution left in the island's table");

  const candidates = BUILTINS.filter((plugin) => !plugin.essential).map((plugin) => plugin.id);
  const checked = candidates.filter((id) => (only ? only.includes(id) : everyone || owners.has(id)));
  const skipped = candidates.filter((id) => !checked.includes(id));
  if (skipped.length) messages.push(`SKIP not moved to their plugin yet (no slot item owned by the id): ${skipped.join(", ")}`);
  const found: string[] = [];
  for (const id of checked) {
    const left = await offPass(id, domains);
    found.push(...left);
    messages.push(`${left.length ? "LEFT" : "PASS"} ${id}${left.length ? ` (${left.length})` : ""}: switched off, ${left.length ? "it leaves things behind" : "nothing of it is left in the island or settings"}`);
  }
  check(found.length === 0, `No checked built-in plugin leaves anything behind${found.length ? `:\n  ${found.join("\n  ")}` : ""}`);
  results.textContent = `${messages.join("\n")}\nALL PASS`;
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  document.documentElement.dataset.testResult = "failed";
  console.error(error);
} finally {
  await unmount();
}
