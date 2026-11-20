import { act } from "react";

const row = (item: string) => document.querySelector<HTMLElement>(`.collapsed-items__item[data-item='${item}']`);
const style = (item: string) => row(item)?.querySelector<HTMLDetailsElement>("details.collapsed-items__style");
const titles = (item: string) => [...(style(item)?.querySelectorAll(".settings-row__title") ?? [])].map((title) => title.textContent);

export async function checkIslandLayout(check: (condition: unknown, message: string) => void) {
  const preview = document.querySelector(".island-bar-preview__bar");
  const chips = [...(preview?.querySelectorAll<HTMLElement>(".island-bar-preview__item") ?? [])].map((chip) => chip.dataset.item);
  check(chips[0] === "status-light" && chips.includes("session-count") && chips.includes("center"), "The island layout page draws the collapsed bar with its items in order");
  check(!style("status-light")?.open && titles("status-light").includes("样式"), "A row with a style keeps it folded under the row");
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
  check(before[0] === "panel:fuyu" && before[1] === "agents" && before[2] === "todo" && before.includes("timer") && before.includes("qq") && previewTabs()[0] === "panel:fuyu"
    && document.querySelector(".expanded-preview__tab[data-page='panel:fuyu'] .panel-text-icon")?.textContent === "Fuyu" && !document.querySelector(".layout-chip--create") && !document.querySelector(".collapsed-items__zone"),
    "Switching to the expanded island draws its preview and lists the Fuyu page first, then the built-in pages in today's order, with no way to make more panels");
  await act(async () => { altArrow(pageRow("todo")!, "ArrowLeft"); });
  check(pageIds()[1] === "todo" && savedPages()?.order[1] === "todo" && previewTabs()[1] === "todo", "Alt+Left moves a page forward, saves the order and the preview follows");
  await act(async () => { pageRow("music")!.querySelector<HTMLButtonElement>(".layout-chip__action")!.click(); });
  check(pageRow("music")?.dataset.hidden !== undefined && savedPages()?.hidden.includes("music") && !previewTabs().includes("music"), "Hiding a page keeps the feature on and takes it off the preview's top bar");
  await act(async () => { pageRow("calendar")!.click(); });
  check(document.querySelector(".expanded-preview__page[data-page='calendar']") && pageRow("calendar")?.getAttribute("aria-selected") === "true", "Clicking a page chip shows that page on the preview");
  await act(async () => { document.querySelector<HTMLButtonElement>(".layout-chips__reset")!.click(); });
  check(savedPages() === null && pageIds()[0] === "panel:fuyu" && pageIds()[1] === "agents", "Restoring the default order removes the key");
}

const savedPanels = () => JSON.parse(localStorage.getItem("fuyu-custom-panels") ?? "null") as { panels: { id: string; name: string; icon: string; items: { widget: string; size: string; x: number; y: number }[] }[] } | null;
const addChip = (widget: string) => document.querySelector<HTMLButtonElement>(`.panel-bucket[data-bucket='add'] [data-widget='${widget}']`);
const panelChip = (widget: string) => document.querySelector<HTMLElement>(`.panel-bucket[data-bucket='in'] [data-widget='${widget}']`);
const layoutOf = () => (savedPanels()?.panels[0].items ?? []).map((item) => `${item.widget}:${item.size}@${item.x},${item.y}`).join(" ");

const modeButton = (mode: string) => document.querySelector<HTMLButtonElement>(`.panel-head__modes [data-mode='${mode}']`);
const pointer = (type: string, target: EventTarget, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 9, clientX: x, clientY: y }));

async function checkFreeCanvas(check: (condition: unknown, message: string) => void) {
  check(!document.querySelector(".expanded-preview__stretch") && document.querySelector(".panel-bucket[data-bucket='in']"), "A grid panel has no drag canvas, only chips");
  await act(async () => { modeButton("free")!.click(); });
  check(document.querySelector(".expanded-preview__grid[data-mode='free']") && document.querySelectorAll(".expanded-preview__stretch").length === 3 && modeButton("free")?.getAttribute("aria-checked") === "true",
    "Switching a panel to free shows a canvas with a resize corner on every widget");
  const lyrics = document.querySelector<HTMLElement>(".expanded-preview__cell[data-widget='lyrics']")!;
  const scale = Number(getComputedStyle(document.querySelector(".expanded-preview__island")!).zoom) || 1;
  await act(async () => { pointer("pointerdown", lyrics, 100, 100); pointer("pointermove", window, 100 + 40 * scale, 100 + 80 * scale); pointer("pointerup", window, 100 + 40 * scale, 100 + 80 * scale); });
  check(layoutOf() === "todos:l@0,0 session-count:m@32,0 lyrics:w@0,42", `Dragging on the canvas moves the widget in 8px steps, kept inside the four columns (${layoutOf()})`);
  await act(async () => { modeButton("grid")!.click(); });
  check(layoutOf() === "todos:l@0,0 session-count:m@32,0 lyrics:w@0,32" && !document.querySelector(".expanded-preview__stretch"), "Back to grid, the widgets flow again by position");
}

export async function checkCustomPanels(check: (condition: unknown, message: string) => void) {
  localStorage.removeItem("fuyu-custom-panels");
  await act(async () => { pageRow("panel:fuyu")!.click(); });
  check(savedPanels() === null && pageRow("panel:fuyu")?.getAttribute("aria-selected") === "true" && pageRow("panel:fuyu")?.textContent?.includes("Fuyu")
    && document.querySelector(".panel-head__modes") && !document.querySelector(".panel-head__name") && !document.querySelector(".panel-head__remove") && document.querySelector(".expanded-preview__empty"),
    "The Fuyu page is there before anything is saved, shows empty and offers only the layout switch, no name or delete");
  check(document.querySelector(".expanded-preview__empty .panel-templates__button[data-template='workbench']") && document.querySelector(".panel-templates__button[data-template='fun']"),
    "The empty panel on the preview offers the workbench and leisure templates");
  check(addChip("todos") && addChip("session-count") && addChip("lyrics") && !addChip("status-light"), "The add bucket lists the built-in widgets but not bar-only items");
  for (const widget of ["todos", "session-count", "lyrics"]) await act(async () => { addChip(widget)!.click(); });
  check(layoutOf() === "todos:m@0,0 session-count:m@32,0 lyrics:w@0,16" && !addChip("todos") && document.querySelectorAll(".expanded-preview__cell").length === 3,
    "Added widgets come in at medium or their only size and are laid out in order");
  check(document.querySelector(".size-picker__tabs [aria-selected='true']")?.getAttribute("data-widget") === "lyrics" && document.querySelectorAll(".size-card").length === 1,
    "The last widget added is selected and a one-size widget offers one card");
  await act(async () => { document.querySelector<HTMLButtonElement>(".size-picker__tabs [data-widget='todos']")!.click(); });
  await act(async () => { document.querySelector<HTMLButtonElement>(".size-card[data-size='l']")!.click(); });
  check(layoutOf() === "todos:l@0,0 session-count:m@32,0 lyrics:w@0,32" && document.querySelector<HTMLElement>(".expanded-preview__slot[data-widget='todos']")?.style.height === "248px",
    "Picking a larger size lays the panel out again and the preview follows");
  await checkFreeCanvas(check);
  await act(async () => { altArrow(panelChip("session-count")!, "ArrowLeft"); });
  check(layoutOf() === "session-count:m@0,0 todos:l@32,0 lyrics:w@0,32", "Alt+Left moves a widget earlier in the panel");
  await act(async () => { panelChip("todos")!.querySelector<HTMLButtonElement>(".layout-chip__action")!.click(); });
  check(layoutOf() === "session-count:m@0,0 lyrics:w@0,16" && addChip("todos"), "Removing a widget closes the gap and puts it back in the add bucket");
  check(savedPanels()?.panels.map((panel) => panel.id).join() === "fuyu", "Edits are saved to the one Fuyu panel");
  await switchMode("bar");
}
