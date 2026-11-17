import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import "../../src/styles/tokens.css";
import { switchOff } from "./builtinsOffMocks";
import { until } from "./pollUntil";
import { windowSlots } from "../../src/features/plugin-kernel/slots";
import { islandContributions } from "../../src/features/plugin-kernel/useIslandContributions";
import { IslandApp } from "../../src/windows/island/IslandApp";
import { ONBOARDING_DEMO_STORAGE_KEY } from "../../src/windows/onboarding/storage";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";

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
localStorage.setItem("fuyu-settings", JSON.stringify({ showCollapsedText: true, showIdleTodoCount: true }));
const today = new Date();
localStorage.setItem("fuyu-current-date", `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
localStorage.setItem("fuyu-todos", JSON.stringify([{ id: "t-1", title: "写周报", completed: false, createdAt: 1 }]));

let root: Root | null = null;
const settle = (ms = 60) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
const mount = () => act(async () => {
  root = createRoot(document.getElementById("root")!);
  root.render(<StrictMode><I18nProvider><IslandApp /></I18nProvider></StrictMode>);
});
const unmount = () => act(async () => {
  root?.unmount();
  root = null;
});
const expand = async () => {
  const button = document.querySelector<HTMLElement>(".island__open-button");
  if (!button) return false;
  await act(async () => { button.click(); });
  await settle();
  return true;
};
const present = (selector: string) => document.querySelector(`#root ${selector}`) !== null;
const activePage = () => document.querySelector<HTMLElement>("#root .dot-button--active")?.className.match(/dot-button--(\w+)(?=\s|$)/)?.[1] ?? null;
const pages = () => windowSlots("island").items("island.page/v1").map((item) => item.id);

const results = document.getElementById("results")!;
const messages: string[] = [];
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
  messages.push(`PASS ${message}`);
};

try {
  await switchOff([]);
  await mount();
  await settle(120);
  check(pages().includes("todo") && islandContributions.snapshot().lines.some((line) => line.item.startsWith("todos.")), "With todos on, the island has the todo page and the todo lines on the collapsed bar");
  check(await until(() => !present(".island--preparing") && !present(".todo-island"), 2000), "Once collapsed preparation settles, the expanded page subtree is hibernated");
  check(await expand() && activePage() === "todo" && present(".todo-island"), "With todos on, the expanded island opens on the todo page");
  await act(async () => { document.querySelector<HTMLElement>(".island__collapse-target")?.click(); });
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    check(present(".todo-island"), "During the close transition, the expanded page stays mounted until the shell finishes closing");
  }
  check(await until(() => !present(".todo-island"), 2000), "After the close transition finishes, the expanded page subtree unmounts again");
  await unmount();

  await switchOff(["todos"]);
  await mount();
  await settle(120);
  check(!pages().includes("todo") && !islandContributions.snapshot().lines.some((line) => line.item.startsWith("todos.")), "With todos off, the todo page and the todo lines are gone");
  check(present(".island") && !present(".island__todo-count") && !present(".island__active-task"), "With todos off, the collapsed island still shows, without a todo count or title");
  check(await expand() && activePage() !== null && activePage() !== "todo" && !present(".todo-island"), `With todos off, the expanded island opens on the next page (${activePage()})`);
  await unmount();

  localStorage.setItem(ONBOARDING_DEMO_STORAGE_KEY, JSON.stringify({ until: Date.now() + 60_000 }));
  await mount();
  await settle(120);
  check(await expand() && activePage() !== null && activePage() !== "todo" && !present(".todo-island"), "During the first-run guide with todos off, the island still opens on another page");
  localStorage.removeItem(ONBOARDING_DEMO_STORAGE_KEY);
  await unmount();
  await switchOff([]);

  results.textContent = `${messages.join("\n")}\nALL PASS`;
  document.documentElement.dataset.testResult = "passed";
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${error instanceof Error ? error.message : String(error)}`;
  document.documentElement.dataset.testResult = "failed";
  console.error(error);
} finally {
  await unmount();
}
