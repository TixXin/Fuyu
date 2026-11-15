import { mockIPC } from "@tauri-apps/api/mocks";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { I18nProvider, LOCALE_STORAGE_KEY, TRANSLATIONS } from "../../src/i18n";

const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, isTauri: true });

const startupWrites: boolean[] = [];
const priorityWrites: string[] = [];
let priority = "releaseFirst";
let releaseYields = false;
const priorityState = () => ({ priority, yielding: priority === "releaseFirst", releaseRunning: true, releaseYields: priority === "devFirst" && releaseYields });
mockIPC((command, payload) => {
  switch (command) {
    case "get_platform_support":
      return { os: "windows", unsupported: [], devBuild: true };
    case "get_dev_priority":
      return priorityState();
    case "set_dev_priority":
      priority = String((payload as { priority?: string } | undefined)?.priority);
      priorityWrites.push(priority);
      return priorityState();
    case "updater_configured":
      return false;
    case "set_launch_at_startup":
      startupWrites.push(Boolean((payload as { enabled?: boolean } | undefined)?.enabled));
      return null;
    default:
      return null;
  }
}, { shouldMockEvents: true });

const { DevWatermark } = await import("../../src/components/DevWatermark");
const { BehaviorSettingsSection } = await import("../../src/features/appearance/BehaviorSettingsSection");
const { UpdatePanel } = await import("../../src/features/updater/UpdatePanel");
const { DevBar } = await import("../../src/windows/settings/DevBar");

const text = TRANSLATIONS["zh-CN"].settings.devBuild;
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const results = document.getElementById("results")!;
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });

try {
  await act(async () => {
    createRoot(document.getElementById("marks")!).render(
      <StrictMode><I18nProvider><DevWatermark place="collapsed" /><DevWatermark place="panel" /></I18nProvider></StrictMode>,
    );
    createRoot(document.getElementById("rows")!).render(
      <StrictMode><I18nProvider>
        <BehaviorSettingsSection launchAtStartup={false} trayIconVisible locale="zh-CN" onLaunchAtStartupChange={(enabled) => startupWrites.push(enabled)} onTrayIconVisibleChange={() => {}} onLocaleChange={() => {}} />
        <UpdatePanel />
        <div id="bar" style={{ position: "relative", height: 40 }}><DevBar /></div>
      </I18nProvider></StrictMode>,
    );
  });
  await settle();

  const marks = [...document.querySelectorAll<HTMLElement>("#marks .dev-watermark")];
  check(marks.length === 2 && marks.every((mark) => mark.textContent === text.mark), "A development build shows the DEV mark on the collapsed island and on the panel");
  check(marks.every((mark) => mark.getAttribute("aria-hidden") === "true" && getComputedStyle(mark).pointerEvents === "none" && getComputedStyle(mark).position === "absolute"),
    "The marks take no clicks, no layout space and are hidden from screen readers");

  const startup = document.querySelector<HTMLInputElement>("#rows .settings-row input[role='switch']");
  check(startup?.disabled === true, "Launch at startup is switched off in a development build");
  startup?.click();
  await settle();
  check(startupWrites.length === 0, "Clicking the disabled switch changes nothing");
  check(document.getElementById("rows")!.textContent?.includes(text.launchAtStartupOff), "The row says why launch at startup is off");
  check(document.getElementById("rows")!.textContent?.includes(text.updateOff), "The update panel says a development build does not update");

  const bar = document.querySelector<HTMLElement>("#bar .dev-bar")!;
  const options = () => [...bar.querySelectorAll<HTMLButtonElement>(".settings-choice__option")];
  check(bar.querySelector(".dev-bar__mark")?.textContent === text.mark && bar.querySelector(".dev-bar__mark")?.getAttribute("aria-hidden") === "true",
    "The settings window carries the DEV mark at its top");
  check(options().map((option) => option.textContent).join() === [text.releaseFirst, text.devFirst].join() && options()[0].getAttribute("aria-pressed") === "true",
    "Next to it is the two-way switch, on release first to begin with");
  check(bar.querySelector(".dev-bar__status")?.textContent === text.status.yielding, "It says the development build has stepped back while the installed app runs");
  options()[1].click();
  await settle();
  check(priorityWrites.join() === "devFirst" && options()[1].getAttribute("aria-pressed") === "true", "Choosing dev first is sent to the island and shown");
  check(bar.querySelector(".dev-bar__status")?.textContent === text.status.both, "With an installed app that does not step back it says so");
  releaseYields = true;
  options()[0].click();
  await settle();
  options()[1].click();
  await settle();
  check(bar.querySelector(".dev-bar__status")?.textContent === text.status.releaseYields, "Once the installed app has stepped back it says approvals come here");

  results.textContent = messages.join("\n");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = [...messages, `FAIL ${error instanceof Error ? error.message : String(error)}`].join("\n");
  document.documentElement.dataset.testResult = "failed";
}
