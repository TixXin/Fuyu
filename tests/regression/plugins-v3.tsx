import { mockIPC } from "@tauri-apps/api/mocks";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import { I18nProvider, LOCALE_STORAGE_KEY, TRANSLATIONS } from "../../src/i18n";
import type { HostInfoV3, PluginHostConnector, PluginHostHandlers, PluginStatusV3 } from "../../src/windows/settings/usePluginHostStatus";

const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
const locale = new URLSearchParams(location.search).get("locale") === "en" ? "en" : "zh-CN";
localStorage.setItem(LOCALE_STORAGE_KEY, locale);
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });

mockIPC((command) => {
  if (command === "get_plugin_host_connection") return { enabled: true, port: 1, token: "t", generation: 1 };
  if (command === "get_platform_support") return { os: "windows", unsupported: [], devBuild: true };
  return null;
});

const { SettingsSidebar } = await import("../../src/windows/settings/SettingsSidebar");
const { PluginsV3SettingsPage } = await import("../../src/windows/settings/PluginsV3SettingsPage");

const text = TRANSLATIONS[locale].settings.pluginsV3;
const usage = (more: Partial<NonNullable<PluginStatusV3["usage"]>> = {}) => ({ cpuMs: 0, calls: 0, applyMs: 0.4, timers: 0, listeners: 0, services: 0, clients: 0, errors: 0, ...more });
const PLUGINS: PluginStatusV3[] = [
  { id: "counter", name: "./counter.mjs", state: "running", kind: "builtin", usage: usage({ cpuMs: 12.5, calls: 40, timers: 2, listeners: 3, services: 1, clients: 1 }) },
  { id: "reader", name: "./reader.mjs", state: "waiting", kind: "essential", waitingFor: ["store", "todos"], usage: usage({ applyMs: null }) },
  { id: "broken", name: "./broken.mjs", state: "failed", kind: "third-party", error: "Error: broken on purpose", usage: usage({ errors: 1 }) },
  { id: "off", name: "./off.mjs", state: "disabled" },
  { id: "flaky-plugin-with-a-really-long-identifier-that-should-not-overflow", name: "./flaky.mjs", state: "auto-disabled", kind: "third-party", blocked: { by: "errors", errors: 5, windowMs: 60000 }, reason: "5 errors within 60 s; it stays off until the host restarts. Last error: Error: flaky broke", lastError: { at: 1, text: "Error: flaky broke\n    at apply (flaky.mjs:3:11)" }, usage: usage({ errors: 5 }) },
  { id: "held", name: "./held.mjs", state: "safe-mode", kind: "third-party", blocked: { by: "safe-mode", mode: "third-party" }, reason: "safe mode \"third-party\" keeps only essential and builtin plugins; this one is third-party", usage: usage({ applyMs: null }) },
  { id: "noisy", name: "./noisy.mjs", state: "running", kind: "third-party", lastError: { at: 2, text: "Error: once" }, usage: usage({ errors: 1, cpuMs: 1500 }) },
];
const HOST: HostInfoV3 = { pid: 4242, node: "26.12.0", startedAt: Date.now() - 65_000, safe: "third-party", dev: true, rssBytes: 42 * 1024 * 1024, heapUsedBytes: 9 * 1024 * 1024, cpuMs: 830 };

function fakeHost() {
  const fake = { handlers: null as PluginHostHandlers | null, open: 0 };
  const connect: PluginHostConnector = (given) => {
    fake.handlers = given;
    fake.open += 1;
    return { close: () => void (fake.open -= 1) };
  };
  return { fake, connect };
}
const main = fakeHost();
const side = fakeHost();

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const results = document.getElementById("results")!;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });
const page = document.getElementById("page")!;
const card = (id: string) => page.querySelector<HTMLElement>(`.plugins-v3__plugin[data-plugin='${id}']`);
const stateText = (id: string) => card(id)?.querySelector(".plugins-v3__state")?.textContent;
const send = (fn: (given: PluginHostHandlers) => void) => act(async () => { fn(main.fake.handlers!); });

try {
  await act(async () => {
    createRoot(document.getElementById("sidebar")!).render(
      <StrictMode><I18nProvider><SettingsSidebar category="pluginsV3" onCategoryChange={() => {}} /></I18nProvider></StrictMode>,
    );
    createRoot(page).render(<StrictMode><I18nProvider><PluginsV3SettingsPage connect={main.connect} /></I18nProvider></StrictMode>);
  });
  const narrowRoot = createRoot(document.getElementById("narrow")!);
  await act(async () => {
    narrowRoot.render(<StrictMode><I18nProvider><PluginsV3SettingsPage connect={side.connect} /></I18nProvider></StrictMode>);
  });
  await settle();

  check(document.querySelector(".settings-sidebar__item[data-category='pluginsV3']"), "With the v3 switch on, the sidebar lists the Plugins (v3) page");
  check(page.querySelector("[data-connection='connecting']")?.textContent === text.connection.connecting, "Before the host answers the page says it is connecting");
  check(page.textContent?.includes(text.waitingHost), "and that plugins show up once it is connected");

  await send((given) => {
    given.onState("open");
    given.onSnapshot({ plugins: PLUGINS, host: HOST });
  });
  check(page.querySelector("[data-connection='open']")?.textContent === text.connection.open, "Once connected it says so");
  check(page.textContent?.includes(text.hostDetail(4242, "26.12.0")) && page.textContent?.includes("42.0 MB"), "The host row shows its process, Node version and memory");
  check(page.textContent?.includes(text.safeModes["third-party"]) && page.textContent?.includes(text.devMode), "Safe mode and dev mode are shown when the host runs in them");

  check(stateText("counter") === text.states.running && card("counter")!.textContent!.includes("12.5 ms"), "A running plugin shows its state and CPU");
  const counterUsage = [...card("counter")!.querySelectorAll("dd")].map((value) => value.textContent);
  check(counterUsage.join("|") === "12.5 ms|0.40 ms|2|3|1|1|0", "and its start time, timers, listeners, services, UI files and errors");
  check(stateText("reader") === text.states.waiting && card("reader")!.textContent!.includes(text.waitingFor("store, todos")), "A waiting plugin names the services it waits for");
  check(card("reader")!.textContent!.includes("–"), "A plugin that has not started shows no start time");
  check(stateText("broken") === text.states.failed && card("broken")!.textContent!.includes("broken on purpose"), "A failed plugin shows why");
  check(stateText("off") === text.states.disabled && !card("off")!.querySelector(".plugins-v3__usage"), "A plugin switched off in plugins.yml shows as off");
  const flaky = card("flaky-plugin-with-a-really-long-identifier-that-should-not-overflow")!;
  check(flaky.dataset.state === "auto-disabled" && flaky.textContent!.includes(text.autoDisabled(5, 60)) && flaky.querySelector(".plugins-v3__last-error"), "A plugin the host turned off says why in the window's language, with its last error at hand");
  check(stateText("held") === text.states["safe-mode"] && card("held")!.textContent!.includes(text.heldBySafeMode(text.safeModes["third-party"])), "A plugin held back by safe mode says so");
  check(card("noisy")!.querySelector(".plugins-v3__last-error") && card("noisy")!.textContent!.includes("1.50 s"), "A running plugin that erred keeps its last error within reach");
  check(card("broken")!.querySelector(".plugins-v3__kind")?.textContent === text.kinds["third-party"] && card("counter")!.querySelector(".plugins-v3__kind")?.textContent === text.kinds.builtin, "Each plugin says what kind it is");

  await send((given) => given.onEvent("plugins", PLUGINS.map((plugin) => (plugin.id === "counter" ? { ...plugin, usage: usage({ cpuMs: 20, timers: 1 }) } : plugin))));
  check(card("counter")!.textContent!.includes("20.0 ms"), "A plugins event updates the numbers in place");
  await send((given) => given.onEvent("host", { ...HOST, rssBytes: 50 * 1024 * 1024 }));
  check(page.textContent?.includes("50.0 MB"), "A host event updates the host's memory");

  await send((given) => given.onState("reconnecting"));
  check(page.querySelector("[data-connection='reconnecting']")?.textContent === text.connection.reconnecting, "When the host restarts the page says it is reconnecting");
  check(page.querySelector(".plugins-v3__list--stale"), "and dims the last list it had");
  await send((given) => {
    given.onState("open");
    given.onSnapshot({ plugins: [PLUGINS[0]], host: { ...HOST, pid: 5151, safe: null, dev: false } });
  });
  check(page.textContent?.includes(text.hostDetail(5151, "26.12.0")) && page.querySelectorAll(".plugins-v3__plugin").length === 1, "After the restart the new snapshot replaces everything it showed");
  check(!page.textContent?.includes(text.safeMode), "A host out of safe mode no longer shows it");
  await send((given) => given.onSnapshot({ plugins: [], host: HOST }));
  check(page.textContent?.includes(text.empty), "With no plugins configured it says so");

  const narrow = document.getElementById("narrow")!;
  check(main.fake.open === 1 && side.fake.open === 1, "Each page keeps exactly one connection to the host open");
  const narrowHandlers = side.fake.handlers!;
  await act(async () => {
    narrowHandlers.onState("open");
    narrowHandlers.onSnapshot({ plugins: PLUGINS, host: HOST });
  });
  const overflowing = [...narrow.querySelectorAll<HTMLElement>(".plugins-v3__plugin, .plugins-v3__plugin-head, .settings-row")].filter((element) => element.scrollWidth > element.clientWidth + 1);
  check(narrow.querySelectorAll(".plugins-v3__plugin").length > 0 && overflowing.length === 0, "In a 300 px wide window nothing spills out sideways");
  await act(async () => narrowRoot.unmount());
  check(side.fake.open === 0, "Leaving the page closes its connection");
  await send((given) => given.onSnapshot({ plugins: PLUGINS, host: HOST }));

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
