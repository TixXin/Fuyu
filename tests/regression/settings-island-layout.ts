import { act } from "react";
import { saveCollapsedText } from "../../src/lib/settings/collapsedText";
import { FUYU_PANEL_ID, PANEL_ICONS, saveCustomPanels } from "../../src/lib/settings/customPanels";

const styleTab = () => document.querySelector<HTMLElement>(".lane-styles__tabs [aria-selected='true']")?.dataset.item;
const styleTitles = () => [...document.querySelectorAll(".lane-styles__body .settings-row__title")].map((title) => title.textContent);

export async function checkIslandLayout(check: (condition: unknown, message: string) => void) {
  const preview = document.querySelector(".island-bar-preview__bar");
  const chips = [...(preview?.querySelectorAll<HTMLElement>(".island-bar-preview__item") ?? [])].map((chip) => chip.dataset.item);
  check(chips[0] === "status-light" && chips.includes("session-count") && chips.includes("center"), "The island layout page draws the collapsed bar with its items in order");
  check(styleTab() === "center" && styleTitles().includes("图案") && document.querySelector(".lane-styles__tabs [data-item='todos-count']") && document.querySelector(".lane-styles__tabs [data-item='status-light']"),
    "The style card has a tab per styled item, the center pattern first");
  await act(async () => { preview!.querySelector<HTMLButtonElement>("[data-item='session-count']")!.click(); });
  check(styleTab() === "session-count" && document.querySelector(".lane-chip[data-item='session-count']")?.classList.contains("lane-chip--found") && styleTitles().includes("样式"),
    "Clicking an item on the preview points at its chip and shows the session ring style");
  await act(async () => { document.querySelector<HTMLButtonElement>(".lane-chip[data-item='status-light'] .lane-chip__style")!.click(); });
  check(styleTab() === "status-light" && styleTitles().includes("样式"), "A chip's style button switches the style card to it");
  check(tabs().join() === "islandLayout,islandPanel,islandDisplay" && activeTab() === "islandLayout" && !document.querySelector(".layout-stage__switch"),
    "Island layout has the same tabs as the other pages, opening on the collapsed island, with no switch of its own on the stage");
  await openTab("islandDisplay");
  check(rowTitles().includes("放不下的项目收进「+N」") && !document.querySelector(".layout-stage"), "Display and notch is its own tab with the +N switch and no preview stage");
  await checkTextOrder(check);
}

const textOrder = () => [...document.querySelectorAll<HTMLElement>("[data-text-order]")].map((row) => row.dataset.textOrder).join();
const savedText = () => JSON.parse(localStorage.getItem("fuyu-collapsed-text") ?? "null") as { order?: string[]; hidden?: string[] } | null;

async function checkTextOrder(check: (condition: unknown, message: string) => void) {
  check(textOrder() === "meeting,lyrics,agent,todos" && savedText() === null, "Text order starts from the old lyrics-first choice without writing anything");
  await act(async () => { document.querySelector<HTMLButtonElement>("[data-text-order='todos'] .text-order__move")!.click(); });
  check(textOrder() === "meeting,lyrics,todos,agent" && savedText()?.order?.join() === "meeting,lyrics,todos,agent", "Moving to-dos up reorders the list and saves the whole order");
  await act(async () => { document.querySelector<HTMLInputElement>("[data-text-order='lyrics'] input[role='switch']")!.click(); });
  check(savedText()?.hidden?.join() === "lyrics" && !document.querySelector<HTMLInputElement>("[data-text-order='lyrics'] input")!.checked, "Switching lyrics off hides them from the bar");
  await act(async () => { saveCollapsedText({ order: null, hidden: [] }); });
}

const pageIds = () => [...document.querySelectorAll<HTMLElement>(".island-pages__item")].map((item) => item.dataset.page);
const pageRow = (page: string) => document.querySelector<HTMLElement>(`.island-pages__item[data-page='${page}']`);
const savedPages = () => JSON.parse(localStorage.getItem("fuyu-island-pages") ?? "null") as { order: string[]; hidden: string[] } | null;
const previewTabs = () => [...document.querySelectorAll<HTMLElement>(".expanded-preview__tab")].map((tab) => tab.dataset.page);
const altArrow = (element: Element, key: string) => element.dispatchEvent(new KeyboardEvent("keydown", { key, altKey: true, bubbles: true }));
const tabs = () => [...document.querySelectorAll<HTMLElement>(".settings-tabs__tab")].map((tab) => tab.dataset.tab);
const activeTab = () => document.querySelector<HTMLElement>(".settings-tabs__tab--active")?.dataset.tab;
const rowTitles = () => [...document.querySelectorAll(".editor-panel .settings-row__title")].map((title) => title.textContent);
const headButtons = () => [...document.querySelectorAll<HTMLElement>(".expanded-preview__head-start .expanded-preview__tab--button")].map((tab) => tab.dataset.page).join();
const headActions = () => [...document.querySelectorAll<HTMLElement>(".expanded-preview__action")].map((action) => action.dataset.action).join();
const islandBox = () => document.querySelector<HTMLElement>(".expanded-preview__island")?.style;
const openTab = (tab: string) => act(async () => { document.querySelector<HTMLButtonElement>(`.settings-tabs__tab[data-tab='${tab}']`)!.click(); });

export async function checkIslandPages(check: (condition: unknown, message: string) => void) {
  localStorage.removeItem("fuyu-island-pages");
  await openTab("islandPanel");
  const before = pageIds();
  check(before[0] === "panel:fuyu" && before[1] === "agents" && before[2] === "todo" && before.includes("timer") && before.includes("qq") && previewTabs()[0] === "panel:fuyu"
    && document.querySelector(".expanded-preview__tab[data-page='panel:fuyu'] .panel-text-icon")?.textContent === "Fuyu" && !document.querySelector(".layout-chip--create") && !document.querySelector(".collapsed-lanes"),
    "The expanded panel tab draws its preview and lists the Fuyu page first, then the built-in pages in today's order, with no way to make more panels");
  check(headButtons() === "qq" && !document.querySelector(".expanded-preview__tab--page[data-page='qq']") && headActions() === "layout,settings" && islandBox()?.width === "800px" && islandBox()?.height === "320px",
    "The preview header is the island's: page tabs, then messages as a bell button, layout and settings on the right, at the page's real size");
  await act(async () => { altArrow(pageRow("todo")!, "ArrowLeft"); });
  check(pageIds()[1] === "todo" && savedPages()?.order[1] === "todo" && previewTabs()[1] === "todo", "Alt+Left moves a page forward, saves the order and the preview follows");
  await act(async () => { pageRow("music")!.querySelector<HTMLButtonElement>(".layout-chip__action")!.click(); });
  check(pageRow("music")?.dataset.hidden !== undefined && savedPages()?.hidden.includes("music") && !previewTabs().includes("music"), "Hiding a page keeps the feature on and takes it off the preview's top bar");
  await act(async () => { pageRow("calendar")!.click(); });
  check(document.querySelector(".expanded-preview__page[data-page='calendar']") && pageRow("calendar")?.getAttribute("aria-selected") === "true" && headActions() === "settings",
    "Clicking a page chip shows that page on the preview, without the panel layout button");
  await checkPageIcons(check);
}

const iconOption = (icon: string) => document.querySelector<HTMLButtonElement>(`.page-icon-picker [data-icon='${icon}']`);
const savedIcons = () => (savedPages() as { icons?: Record<string, string> } | null)?.icons;

async function checkPageIcons(check: (condition: unknown, message: string) => void) {
  check(document.querySelector(".page-icon-picker[data-page='calendar']") && iconOption("default")?.getAttribute("aria-checked") === "true" && !iconOption("text"),
    "The picked page shows a tab icon picker with Default chosen");
  await act(async () => { iconOption("star")!.click(); });
  check(savedIcons()?.calendar === "star" && iconOption("star")?.getAttribute("aria-checked") === "true"
    && document.querySelector(".expanded-preview__tab[data-page='calendar'] svg.lucide-star") && pageRow("calendar")?.querySelector("svg.lucide-star"),
    "Picking an icon saves it in fuyu-island-pages and the preview tab and page chip follow");
  await act(async () => { pageRow("panel:fuyu")!.click(); });
  check(iconOption("text")?.getAttribute("aria-checked") === "true" && iconOption("jellyfish") && !iconOption("default"), "The Fuyu page offers the word and the jellyfish, with the word chosen by default");
  await act(async () => { iconOption("jellyfish")!.click(); });
  check(savedIcons()?.["panel:fuyu"] === "jellyfish" && document.querySelector(".expanded-preview__tab[data-page='panel:fuyu'] .center-jelly"), "Choosing the jellyfish for the Fuyu tab is saved and previewed");
  await act(async () => { iconOption("text")!.click(); });
  check(savedIcons()?.["panel:fuyu"] === undefined, "Going back to the word drops the Fuyu entry");
  await act(async () => { document.querySelector<HTMLButtonElement>(".layout-chips__reset")!.click(); });
  check(savedPages()?.order.length === 0 && savedPages()?.hidden.length === 0 && savedIcons()?.calendar === "star" && pageIds()[0] === "panel:fuyu" && pageIds()[1] === "agents",
    "Restoring the default order keeps the chosen icons");
  await act(async () => { pageRow("calendar")!.click(); });
  await act(async () => { iconOption("default")!.click(); });
  check(savedPages() === null, "With the default order and no icons left the key is removed");
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
  const zoomOf = (selector: string) => Number(getComputedStyle(document.querySelector(selector)!).zoom) || 1;
  const scale = zoomOf(".expanded-preview__island") * zoomOf(".expanded-preview__zoom");
  await act(async () => { pointer("pointerdown", lyrics, 100, 100); pointer("pointermove", window, 100 + 40 * scale, 100 + 80 * scale); pointer("pointerup", window, 100 + 40 * scale, 100 + 80 * scale); });
  check(layoutOf() === "todos:l@0,0 session-count:m@32,0 lyrics:w@37,16", `Switching to free starts from the island's two-row layout, and dragging moves the widget in 8px steps, kept inside the two rows (${layoutOf()})`);
  await act(async () => { modeButton("grid")!.click(); });
  check(layoutOf() === "todos:l@0,0 session-count:m@32,0 lyrics:w@0,32" && !document.querySelector(".expanded-preview__stretch"), "Back to grid, the widgets flow again by position");
}

const slotAt = (widget: string) => {
  const slot = document.querySelector<HTMLElement>(`.expanded-preview__slot[data-widget='${widget}']`);
  return `${slot?.style.left},${slot?.style.top}`;
};
const pager = () => [...document.querySelectorAll<HTMLElement>(".expanded-preview__pager button")].map((dot) => dot.getAttribute("aria-pressed")).join();
const shift = () => document.querySelector<HTMLElement>(".expanded-preview__grid")?.style.transform;

async function checkPreviewPages(check: (condition: unknown, message: string) => void) {
  for (const widget of ["todos", "music", "countdown", "network", "water"]) await act(async () => { addChip(widget)!.click(); });
  check(pager() === "false,true" && shift() === "translateX(-768px)" && slotAt("water") === "768px,0px",
    "Past six columns the preview gets a second page, and it turns to the page of the widget just picked");
  await act(async () => { document.querySelector<HTMLButtonElement>(".expanded-preview__pager [data-page-index='0']")!.click(); });
  check(pager() === "true,false" && shift() === "translateX(0px)", "The dots under the preview turn back to the first page");
}

export async function checkCustomPanels(check: (condition: unknown, message: string) => void) {
  localStorage.removeItem("fuyu-custom-panels");
  await act(async () => { pageRow("panel:fuyu")!.click(); });
  check(savedPanels() === null && pageRow("panel:fuyu")?.getAttribute("aria-selected") === "true" && pageRow("panel:fuyu")?.textContent?.includes("Fuyu")
    && document.querySelector(".panel-head__modes") && !document.querySelector(".panel-head__name") && !document.querySelector(".panel-head__remove")
    && !document.querySelector(".expanded-preview__empty") && document.querySelectorAll(".expanded-preview__cell").length > 0,
    "The Fuyu page is there before anything is saved, shows the default widgets and offers only the layout switch, no name or delete");
  await act(async () => {
    saveCustomPanels([{ id: FUYU_PANEL_ID, name: "", icon: PANEL_ICONS[0], mode: "grid", items: [] }]);
    window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-custom-panels" }));
  });
  check(document.querySelector(".expanded-preview__empty") && document.querySelectorAll(".expanded-preview__cell").length === 0, "A Fuyu panel saved with no widgets shows empty");
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
  check(slotAt("todos") === "0px,0px" && slotAt("session-count") === "256px,0px" && slotAt("lyrics") === "256px,128px" && !document.querySelector(".expanded-preview__pager"),
    "The preview lays widgets out like the island: two rows, filled column by column, six columns to a page");
  await checkFreeCanvas(check);
  await act(async () => { altArrow(panelChip("session-count")!, "ArrowLeft"); });
  check(layoutOf() === "session-count:m@0,0 todos:l@32,0 lyrics:w@0,32", "Alt+Left moves a widget earlier in the panel");
  await act(async () => { panelChip("todos")!.querySelector<HTMLButtonElement>(".layout-chip__action")!.click(); });
  check(layoutOf() === "session-count:m@0,0 lyrics:w@0,16" && addChip("todos"), "Removing a widget closes the gap and puts it back in the add bucket");
  check(savedPanels()?.panels.map((panel) => panel.id).join() === "fuyu", "Edits are saved to the one Fuyu panel");
  await checkPreviewPages(check);
  await openTab("islandLayout");
}
