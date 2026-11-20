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
const previewTabs = () => [...document.querySelectorAll<HTMLElement>(".expanded-preview__tab")].map((tab) => tab.dataset.page);
const altArrow = (element: Element, key: string) => element.dispatchEvent(new KeyboardEvent("keydown", { key, altKey: true, bubbles: true }));
const switchMode = (mode: string) => act(async () => { document.querySelector<HTMLButtonElement>(`.layout-stage__switch button[data-mode='${mode}']`)!.click(); });

export async function checkIslandPages(check: (condition: unknown, message: string) => void) {
  localStorage.removeItem("fuyu-island-pages");
  check(document.querySelector(".island-bar-preview__bar") && !document.querySelector(".expanded-preview"), "The island layout page opens on the collapsed bar");
  await switchMode("expanded");
  const before = pageIds();
  check(before[0] === "agents" && before[1] === "todo" && before.includes("timer") && before.includes("qq") && previewTabs()[0] === "agents" && !document.querySelector(".collapsed-items__zone"),
    "Switching to the expanded island draws its preview and lists the built-in pages as chips in today's order");
  await act(async () => { altArrow(pageRow("todo")!, "ArrowLeft"); });
  check(pageIds()[0] === "todo" && savedPages()?.order[0] === "todo" && previewTabs()[0] === "todo", "Alt+Left moves a page forward, saves the order and the preview follows");
  await act(async () => { pageRow("music")!.querySelector<HTMLButtonElement>(".layout-chip__action")!.click(); });
  check(pageRow("music")?.dataset.hidden !== undefined && savedPages()?.hidden.includes("music") && !previewTabs().includes("music"), "Hiding a page keeps the feature on and takes it off the preview's top bar");
  await act(async () => { pageRow("calendar")!.click(); });
  check(document.querySelector(".expanded-preview__page[data-page='calendar']") && pageRow("calendar")?.getAttribute("aria-selected") === "true", "Clicking a page chip shows that page on the preview");
  await act(async () => { document.querySelector<HTMLButtonElement>(".layout-chips__reset")!.click(); });
  check(savedPages() === null && pageIds()[0] === "agents", "Restoring the default order removes the key");
}

const savedPanels = () => JSON.parse(localStorage.getItem("fuyu-custom-panels") ?? "null") as { panels: { id: string; name: string; icon: string; items: { widget: string; size: string; x: number; y: number }[] }[] } | null;
const addChip = (widget: string) => document.querySelector<HTMLButtonElement>(`.panel-bucket[data-bucket='add'] [data-widget='${widget}']`);
const panelChip = (widget: string) => document.querySelector<HTMLElement>(`.panel-bucket[data-bucket='in'] [data-widget='${widget}']`);
const layoutOf = () => (savedPanels()?.panels[0].items ?? []).map((item) => `${item.widget}:${item.size}@${item.x},${item.y}`).join(" ");

export async function checkCustomPanels(check: (condition: unknown, message: string) => void) {
  localStorage.removeItem("fuyu-custom-panels");
  check(savedPanels() === null && !document.querySelector(".panel-head"), "There are no custom panels until one is made");
  await act(async () => { document.querySelector<HTMLButtonElement>(".layout-chip--create")!.click(); });
  const created = savedPanels()?.panels[0];
  check(created && created.name === "新面板" && created.icon === "layout-grid" && pageRow(`panel:${created.id}`)?.getAttribute("aria-selected") === "true"
    && document.querySelector(".panel-head") && document.querySelector(".expanded-preview__empty"), "A new panel is saved, listed and shown empty on the preview");
  check(addChip("todos") && addChip("session-count") && addChip("lyrics") && !addChip("status-light"), "The add bucket lists the built-in widgets but not bar-only items");
  for (const widget of ["todos", "session-count", "lyrics"]) await act(async () => { addChip(widget)!.click(); });
  check(layoutOf() === "todos:m@0,0 session-count:m@32,0 lyrics:w@0,16" && !addChip("todos") && document.querySelectorAll(".expanded-preview__cell").length === 3,
    "Added widgets come in at medium or their only size and are laid out in order");
  check(document.querySelector(".size-picker__tabs [aria-selected='true']")?.getAttribute("data-widget") === "lyrics" && document.querySelectorAll(".size-card").length === 1,
    "The last widget added is selected and a one-size widget offers one card");
  await act(async () => { document.querySelector<HTMLButtonElement>(".size-picker__tabs [data-widget='todos']")!.click(); });
  await act(async () => { document.querySelector<HTMLButtonElement>(".size-card[data-size='l']")!.click(); });
  check(layoutOf() === "todos:l@0,0 session-count:m@32,0 lyrics:w@0,32" && document.querySelector<HTMLElement>(".expanded-preview__cell[data-widget='todos']")?.style.height === "248px",
    "Picking a larger size lays the panel out again and the preview follows");
  await act(async () => { altArrow(panelChip("session-count")!, "ArrowLeft"); });
  check(layoutOf() === "session-count:m@0,0 todos:l@32,0 lyrics:w@0,32", "Alt+Left moves a widget earlier in the panel");
  await act(async () => { panelChip("todos")!.querySelector<HTMLButtonElement>(".layout-chip__action")!.click(); });
  check(layoutOf() === "session-count:m@0,0 lyrics:w@0,16" && addChip("todos"), "Removing a widget closes the gap and puts it back in the add bucket");
  const name = document.querySelector<HTMLInputElement>(".panel-head__name")!;
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setValue.call(name, "工作台");
    name.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => { name.dispatchEvent(new FocusEvent("focusout", { bubbles: true })); });
  check(savedPanels()?.panels[0].name === "工作台" && pageRow(`panel:${created!.id}`)?.textContent?.includes("工作台"), "Renaming a panel saves the new name");
  const remove = document.querySelector<HTMLButtonElement>(".panel-head__remove")!;
  await act(async () => { remove.click(); });
  await act(async () => { remove.click(); });
  check(savedPanels() === null && !pageIds().some((page) => page?.startsWith("panel:")), "Deleting the last panel removes the key and the page");
  await switchMode("bar");
}
