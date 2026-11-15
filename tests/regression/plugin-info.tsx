import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/features/plugins/PluginCard.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { PluginInfoList } from "../../src/features/plugins/PluginInfoList";
import type { PluginInfoItem } from "../../src/features/plugins/api";

const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });

const calls: { command: string; args: Record<string, unknown> }[] = [];
mockIPC((command, payload) => {
  calls.push({ command, args: (payload ?? {}) as Record<string, unknown> });
  if (command === "copy_plugin_info") return null;
  throw new Error(`Unexpected command ${command}`);
});
const written: string[] = [];
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { written.push(text); } } });

const items: PluginInfoItem[] = [
  { label: { "zh-CN": "地址", en: "Address" }, value: "http://127.0.0.1:39271/v1", hasValue: true, copy: true, secret: false },
  { label: { "zh-CN": "访问令牌", en: "Access token" }, value: "", hasValue: true, copy: true, secret: true },
  { label: { "zh-CN": "备用令牌", en: "Spare token" }, value: "", hasValue: false, copy: true, secret: true },
];

const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};
const page = document.getElementById("page")!;
const root = createRoot(page);
const rows = () => [...page.querySelectorAll<HTMLElement>(".plugin-info__row")];
const buttons = (row: HTMLElement) => [...row.querySelectorAll<HTMLButtonElement>("button")];
const click = async (button: HTMLButtonElement) => {
  await act(async () => { button.click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
};

try {
  await act(async () => {
    root.render(<StrictMode><I18nProvider><PluginInfoList items={items} pluginId="focusd.local-api" /></I18nProvider></StrictMode>);
  });
  const [address, token, empty] = rows();
  check(token.querySelector("code")?.textContent === "•".repeat(12) && buttons(token).map((button) => button.textContent).join("|") === "复制",
    "A secret item shows dots and only a Copy button, no Show");
  check(empty.querySelector("code")?.textContent === "" && buttons(empty).length === 0, "A secret item without a value has nothing to copy");
  await click(buttons(token)[0]);
  check(calls.length === 1 && calls[0].command === "copy_plugin_info" && calls[0].args.id === "focusd.local-api" && calls[0].args.index === 1 && written.length === 0,
    "Copying a secret asks Rust to write the clipboard by plugin and index, never through the page");
  check(buttons(token)[0].textContent === "已复制", "The button says the secret was copied");
  await click(buttons(address)[0]);
  check(written.join("|") === "http://127.0.0.1:39271/v1" && calls.length === 1, "A plain item is still copied by the page");
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  document.documentElement.dataset.testResult = "failed";
  messages.push(`FAIL ${String(error)}`);
  console.error(error);
} finally {
  document.getElementById("results")!.textContent = messages.join("\n");
}
