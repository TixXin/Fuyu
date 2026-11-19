import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { ipc, locale, MB, PLUGIN, NORMAL, HOST } from "./pluginPageMocks";
import { I18nProvider, TRANSLATIONS } from "../../src/i18n";
import type { PluginHostView } from "../../src/windows/settings/usePluginHostStatus";

const { PluginDiagnosticsView } = await import("../../src/windows/settings/PluginDiagnosticsPage");
const { takePluginDetailRequest } = await import("../../src/windows/settings/pluginPageHandoff");

const t = TRANSLATIONS[locale].settings.pluginsV3;
const NOW = HOST.startedAt + 65_000;
const bisectCalls: string[] = [];
const bisect = (off: readonly string[]) => (bisectCalls.push(off.join(",")), Promise.resolve({ off: [...off], unknown: [] }));
const plugins = [...NORMAL, PLUGIN.feeds, PLUGIN.flaky, { id: "agents", name: "agents", state: "running", kind: "builtin" as const, usage: { cpuMs: 900, calls: 300, applyMs: 1.2, timers: 2, listeners: 4, services: 1, clients: 0, errors: 0 } }];
const STAGES: { key: string; title: string; view: PluginHostView; hostOff?: boolean }[] = [
  { key: "safe", title: "安全模式 / Safe mode", view: { connection: "open", plugins, host: { ...HOST, safe: "third-party" }, memory: { pid: HOST.pid, bytes: 25.2 * MB, measure: "private-working-set" }, safeMode: { mode: "third-party", cause: "shift", failures: 0 }, bisect } },
  { key: "running", title: "正常 / Running", view: { connection: "open", plugins, host: HOST, memory: null, safeMode: null, bisect } },
  { key: "offline", title: "连不上 / Offline", view: { connection: "reconnecting", plugins, host: HOST, memory: null, safeMode: null } },
  { key: "hostOff", title: "插件功能被关掉 / Plugins off", view: { connection: "closed", plugins: [], host: null, memory: null, safeMode: null }, hostOff: true },
];

const opened: string[] = [];
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const settle = (ms = 80) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const gallery = document.getElementById("gallery")!;
const stage = (key: string) => gallery.querySelector<HTMLElement>(`[data-stage='${key}']`)!;
const click = (element: Element | null | undefined) => act(async () => { if (!element) throw new Error("missing element to click"); (element as HTMLElement).click(); });
const results = document.getElementById("results")!;

try {
  for (const item of STAGES) {
    const host = document.createElement("section");
    host.className = "gallery__stage settings-stage";
    host.dataset.stage = item.key;
    const heading = document.createElement("h2");
    heading.className = "gallery__title";
    heading.textContent = item.title;
    const body = document.createElement("div");
    host.append(heading, body);
    gallery.append(host);
    await act(async () => {
      createRoot(body).render(
        <StrictMode>
          <I18nProvider>
            <PluginDiagnosticsView view={item.view} hostOff={item.hostOff} now={NOW} builtins={ipc.builtins} onOpenPage={(page) => opened.push(`${item.key}:${page}`)} />
          </I18nProvider>
        </StrictMode>,
      );
    });
    await settle();
  }
  const safe = stage("safe");
  check(safe.querySelector("[data-process='open']") && safe.querySelector("[data-measure='private-working-set']")?.textContent === "25.2 MB", "The process card shows memory measured by Fuyu and names the measure");
  check(stage("running").querySelector("[data-measure='rss']")?.textContent === "42.0 MB", "Without Fuyu's measurement it falls back to the process's own number");
  check(safe.querySelector("[data-banner='safe-mode']")?.textContent!.includes(t.page.banners.safeShift), "Safe mode is explained here too");
  const rows = () => [...safe.querySelectorAll<HTMLElement>("[data-diag-row]")];
  check(rows().length === 8 && rows()[0].dataset.diagRow === PLUGIN.flaky.id && rows()[1].dataset.diagRow === PLUGIN.feeds.id, "The module table starts with the eight busiest, errors first");
  await click(safe.querySelector("[data-action='diag-show-all']"));
  const ids = rows().map((row) => row.dataset.diagRow!);
  check(ipc.builtins.every((builtin) => ids.includes(builtin.id)) && ids.includes("@fuyu/weather") && !ids.includes("counter"), "Show all lists every built-in module next to installed plugins");
  check(safe.querySelector("[data-diag-row='agents']")?.textContent!.includes(t.builtinNames.agents), "Built-in modules carry their names");
  await click(safe.querySelector("[data-diag-row='agents']"));
  check(opened.includes("safe:agents"), "Clicking a built-in module opens its own settings page");
  await click(safe.querySelector(`[data-diag-row='${PLUGIN.feeds.id}']`));
  const request = takePluginDetailRequest();
  check(opened.includes("safe:pluginsV3") && request?.id === PLUGIN.feeds.id && request.tab === "activity", "Clicking a plugin opens its activity on the plugin page");
  await click(safe.querySelector("[data-action='diag-show-all']"));

  await click(stage("running").querySelector("[data-action='bisect-start']"));
  await settle();
  check(stage("running").querySelector("[data-bisect-phase='testing']") && bisectCalls.length === 1 && !bisectCalls[0].includes("agents"), "Bisect switches off half of your plugins and leaves built-in modules alone");
  const answers = () => [...stage("running").querySelectorAll<HTMLButtonElement>("[data-bisect-phase] .plugin-btn")];
  for (let guard = 0; guard < 8 && stage("running").querySelector("[data-bisect-phase='testing']"); guard += 1) {
    await click(answers().find((button) => button.textContent === t.bisect?.stillBroken));
    await settle();
  }
  check(stage("running").querySelector("[data-bisect-phase='found'], [data-bisect-phase='clear']"), "Answering narrows it down to one plugin or clears them all");
  await click(answers().find((button) => button.textContent === t.bisect?.restore));
  await settle();
  check(stage("running").querySelector("[data-bisect-phase='idle']") && bisectCalls[bisectCalls.length - 1] === "", "Finishing turns everything back on");
  check(!stage("offline").querySelector("[data-action='bisect-start']:not(:disabled)") && stage("offline").querySelector("[data-process='reconnecting']"), "While the plugin process is away, bisect is unavailable and the card says it is reconnecting");
  check(!stage("hostOff").querySelector("[data-diag-row^='@']") && stage("hostOff").querySelector("[data-diag-row='todos']"), "With plugins off the table still lists built-in modules");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
