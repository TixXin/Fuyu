import { act } from "react";

const row = (item: string) => document.querySelector<HTMLElement>(`.collapsed-items__item[data-item='${item}']`);
const style = (item: string) => row(item)?.querySelector<HTMLDetailsElement>("details.collapsed-items__style");
const titles = (item: string) => [...(style(item)?.querySelectorAll(".settings-row__title") ?? [])].map((title) => title.textContent);

export async function checkIslandLayout(check: (condition: unknown, message: string) => void) {
  const preview = document.querySelector(".island-bar-preview__bar");
  const chips = [...(preview?.querySelectorAll<HTMLElement>(".island-bar-preview__item") ?? [])].map((chip) => chip.dataset.item);
  check(chips[0] === "status-light" && chips.includes("session-count") && chips.includes("center"), "The island layout page draws the collapsed bar with its items in order");
  check(!style("status-light")?.open && titles("status-light").includes("状态灯样式"), "A row with a style keeps it folded under the row");
  await act(async () => { preview!.querySelector<HTMLButtonElement>("[data-item='session-count']")!.click(); });
  check(style("session-count")?.open && row("session-count")?.classList.contains("collapsed-items__item--found") && titles("session-count").includes("样式"),
    "Clicking an item on the preview opens its row with the session ring style");
  await act(async () => { row("status-light")!.querySelector<HTMLButtonElement>(".collapsed-items__expand")!.click(); });
  check(style("status-light")?.open && !style("session-count")?.open, "Opening another row folds the one before");
  check(row("center") && titles("center").includes("图案") && titles("todos-count").length === 1, "The middle group holds the center pattern and the todo count");
  check([...document.querySelectorAll(".editor-panel .settings-row__title")].some((title) => title.textContent === "放不下的项目收进「+N」"), "The +N switch is on the island layout page");
}

const pageIds = () => [...document.querySelectorAll<HTMLElement>(".island-pages__item")].map((item) => item.dataset.page);
const pageRow = (page: string) => document.querySelector<HTMLElement>(`.island-pages__item[data-page='${page}']`);
const savedPages = () => JSON.parse(localStorage.getItem("fuyu-island-pages") ?? "null") as { order: string[]; hidden: string[] } | null;

export async function checkIslandPages(check: (condition: unknown, message: string) => void) {
  localStorage.removeItem("fuyu-island-pages");
  const before = pageIds();
  check(before[0] === "agents" && before[1] === "todo" && before.includes("timer") && before.includes("qq"), "The expanded pages section lists the built-in pages in today's order");
  await act(async () => { pageRow("todo")!.querySelector<HTMLButtonElement>("button[aria-label^='上移']")!.click(); });
  check(pageIds()[0] === "todo" && savedPages()?.order[0] === "todo", "Moving a page up saves the new order to fuyu-island-pages");
  await act(async () => { pageRow("music")!.querySelector<HTMLInputElement>("input[role='switch']")!.click(); });
  check(pageRow("music")?.dataset.hidden !== undefined && savedPages()?.hidden.includes("music"), "Switching a page off hides it without turning the feature off");
  await act(async () => { document.querySelector<HTMLButtonElement>(".island-pages .collapsed-items__reset")!.click(); });
  check(savedPages() === null && pageIds()[0] === "agents", "Restoring the default order removes the key");
}

const savedPanels = () => JSON.parse(localStorage.getItem("fuyu-custom-panels") ?? "null") as { panels: { id: string; name: string; icon: string; items: { widget: string; size: string; x: number; y: number }[] }[] } | null;
const libraryButton = (widget: string, label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>(`.widget-library__item[data-widget='${widget}'] button`)].find((button) => button.textContent === label);

export async function checkCustomPanels(check: (condition: unknown, message: string) => void) {
  localStorage.removeItem("fuyu-custom-panels");
  check(savedPanels() === null && !document.querySelector(".panel-editor"), "There are no custom panels until one is made");
  await act(async () => { document.querySelector<HTMLButtonElement>(".island-pages__create")!.click(); });
  const created = savedPanels()?.panels[0];
  check(created && created.name === "新面板" && created.icon === "layout-grid" && pageIds().includes(`panel:${created.id}`) && document.querySelector(".panel-editor"),
    "A new panel is saved, listed among the pages and opened for editing");
  check(libraryButton("todos", "大") && libraryButton("session-count", "条") && libraryButton("status-light", "条") && !libraryButton("status-light", "小"),
    "The widget library offers sizes per widget and the bar for collapsed bar items");
  await act(async () => { libraryButton("todos", "大")!.click(); });
  await act(async () => { libraryButton("session-count", "中")!.click(); });
  const items = savedPanels()?.panels[0].items ?? [];
  check(items.length === 2 && items[0].widget === "todos" && items[0].size === "l" && items[1].x === 32 && items[1].y === 0,
    "Adding widgets puts them into the first free cells of the 4-column grid");
  check(document.querySelectorAll(".panel-canvas__item").length === 2, "The canvas draws the widgets");
  await act(async () => { document.querySelector<HTMLButtonElement>(".panel-canvas__remove")!.click(); });
  check(savedPanels()?.panels[0].items.map((item) => item.widget).join() === "session-count", "Removing a widget takes it off the panel");
  const name = document.querySelector<HTMLInputElement>(".panel-editor__name")!;
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setValue.call(name, "工作台");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { name.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
  check(savedPanels()?.panels[0].name === "工作台", "Renaming a panel saves the new name");
  const remove = document.querySelector<HTMLButtonElement>(".panel-editor__remove")!;
  await act(async () => { remove.click(); });
  await act(async () => { remove.click(); });
  check(savedPanels() === null && !pageIds().some((page) => page?.startsWith("panel:")), "Deleting the last panel removes the key and the page");
}
