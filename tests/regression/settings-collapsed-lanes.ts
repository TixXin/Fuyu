import { act } from "react";

type Check = (condition: unknown, message: string) => void;

const names = (selector: string) => [...document.querySelectorAll(`${selector} .lane-chip .layout-chip__name`)].map((name) => name.textContent).join("|");
const lane = (name: string) => names(`.collapsed-lanes__lane[data-lane='${name}']`);
const off = () => names(".collapsed-lanes__off");
const chip = (item: string) => document.querySelector<HTMLElement>(`.lane-chip[data-item='${item}']`);
const button = (label: string) => document.querySelector<HTMLButtonElement>(`.collapsed-lanes button[aria-label="${label}"]`);
const saved = () => JSON.parse(localStorage.getItem("fuyu-collapsed-items") ?? "null") as { items: { id: string; zone: string; hidden?: boolean; shelf?: boolean }[] } | null;
const savedItem = (id: string) => saved()?.items.find((item) => item.id === id);
const toast = () => document.querySelector(".lane-toast span")?.textContent;
const more = () => document.querySelector(".island-bar-preview__more")?.textContent;
const press = (target: Element, key: string, extra: KeyboardEventInit = {}) =>
  act(async () => { target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra })); });
const pointer = (type: string, target: EventTarget, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: type === "pointerup" ? 0 : 1, pointerId: 7, clientX: x, clientY: y }));
const middle = (element: Element) => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};
const overflow = (ids: string[] | null) => act(async () => {
  if (ids) localStorage.setItem("fuyu-collapsed-overflow", JSON.stringify(ids));
  else localStorage.removeItem("fuyu-collapsed-overflow");
  window.dispatchEvent(new StorageEvent("storage", { key: "fuyu-collapsed-overflow" }));
});
const reset = () => act(async () => { document.querySelector<HTMLButtonElement>(".collapsed-lanes__reset")!.click(); });

async function checkKeyboard(check: Check) {
  await press(chip("mail")!, "ArrowLeft", { altKey: true });
  check(lane("left") === "浮屿水母|新邮件提醒" && savedItem("mail")?.zone === "left" && toast() === "「新邮件提醒」放在左侧第 2 个" && document.querySelector(".lane-toast button"),
    "Alt+Left at the start of the right lane moves the item to the end of the left one, saves it and offers an undo");
  await act(async () => { document.querySelector<HTMLButtonElement>(".lane-toast button")!.click(); });
  check(lane("left") === "浮屿水母" && savedItem("mail")?.zone === "right" && toast() === "已撤销", "Undo in the toast puts it back");
  await press(chip("session-count")!, " ");
  await press(chip("session-count")!, "ArrowDown");
  check(lane("shelf") === "会话数 / 会话环" && !savedItem("session-count")?.shelf, "Picked up with Space, the arrow keys move it in the lanes without saving yet");
  await press(chip("session-count")!, "Enter");
  check(savedItem("session-count")?.shelf === true && more() === "+1", "Enter drops it in the +N panel, saved, and the preview shows +1");
  await press(chip("session-count")!, " ");
  await press(chip("session-count")!, "ArrowUp");
  check(lane("shelf") === "" && lane("right").includes("会话数 / 会话环"), "Up takes it out of the panel back to its side while picked up");
  await press(chip("session-count")!, "Escape");
  check(lane("shelf") === "会话数 / 会话环" && savedItem("session-count")?.shelf === true, "Esc puts a picked-up item back where it was");
  await press(chip("status-light")!, "Delete");
  check(savedItem("status-light")?.hidden === true && off() === "浮屿水母|外设电量" && lane("left") === "", "Delete takes an item off the bar into the list below");
  await press(document.body, "z", { ctrlKey: true });
  check(!savedItem("status-light")?.hidden && lane("left") === "浮屿水母", "Ctrl+Z undoes it");
}

async function checkButtons(check: Check) {
  await act(async () => { button("把会话数 / 会话环拿下来")!.click(); });
  check(savedItem("session-count")?.hidden === true && savedItem("session-count")?.shelf === true && off().includes("会话数 / 会话环"), "× takes an item off and keeps where it was");
  await act(async () => { button("把会话数 / 会话环放上去")!.click(); });
  check(!savedItem("session-count")?.hidden && lane("shelf") === "会话数 / 会话环", "+ puts it back in the lane it came from");
  await act(async () => { chip("music")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })); });
  check(document.querySelector(".lane-menu [data-place='right']")?.hasAttribute("disabled") && document.querySelector(".lane-menu [data-place='off']"), "Right-click opens a menu with the current lane ticked");
  await act(async () => { document.querySelector<HTMLButtonElement>(".lane-menu [data-place='left']")!.click(); });
  check(lane("left") === "浮屿水母|音乐" && savedItem("music")?.zone === "left" && !document.querySelector(".lane-menu"), "Choosing a lane in the menu moves the item there");
  await reset();
  check(saved() === null && lane("left") === "浮屿水母" && lane("shelf") === "", "Reset to default clears the saved layout");
}

async function checkDrag(check: Check) {
  const list = document.querySelector(".collapsed-lanes__lane[data-lane='left'] .collapsed-lanes__list")!.getBoundingClientRect();
  const start = middle(chip("timer")!.querySelector(".layout-chip__name")!);
  const end = { x: list.right - 6, y: list.top + list.height / 2 };
  await act(async () => { pointer("pointerdown", chip("timer")!, start.x, start.y); pointer("pointermove", window, end.x, end.y); });
  check(document.querySelector(".lane-ghost") && lane("left") === "浮屿水母|计时器" && saved() === null && document.querySelector(".collapsed-lanes__lane[data-lane='left'][data-over='drop']"),
    "Dragging a chip shows a ghost and previews the drop live without saving");
  await act(async () => { pointer("pointerup", window, end.x, end.y); });
  check(!document.querySelector(".lane-ghost") && savedItem("timer")?.zone === "left" && lane("left") === "浮屿水母|计时器", "Letting go saves the new place");
  const center = document.querySelector(".collapsed-lanes__lane[data-lane='center'] .collapsed-lanes__list")!;
  const target = middle(center);
  const from = middle(chip("music")!.querySelector(".layout-chip__name")!);
  await act(async () => { pointer("pointerdown", chip("music")!, from.x, from.y); pointer("pointermove", window, target.x, target.y); });
  check(document.querySelector(".collapsed-lanes__lane[data-lane='center'][data-over='deny'] .collapsed-lanes__lane-hint")?.textContent === "中间只放中心图案和剩余待办数",
    "The middle lane refuses other items and says why");
  await act(async () => { pointer("pointerup", window, target.x, target.y); });
  check(savedItem("music")?.zone === "right" && !document.querySelector(".lane-ghost"), "Dropping on the middle lane changes nothing");
  await reset();
}

async function checkNotch(check: Check) {
  const notch = async (value: { width: number; height: number } | null) => act(async () => {
    await (await import("@tauri-apps/api/event")).emit("island-notch-changed", value);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  await overflow(["timer"]);
  await notch({ width: 200, height: 32 });
  const wings = [...document.querySelectorAll(".island-bar-preview[data-notch] .island-bar-preview__wing")];
  const itemsIn = (wing: Element | undefined) => [...wing?.querySelectorAll("[data-item]") ?? []].map((item) => item.getAttribute("data-item"));
  check(wings.length === 2 && document.querySelector(".island-bar-preview__wing + .island-bar-preview__notch + .island-bar-preview__wing")
    && itemsIn(wings[0]).join("|") === "status-light" && itemsIn(wings[1])[0] === "center" && itemsIn(wings[1]).includes("mail")
    && !document.querySelector(".island-bar-preview__text") && wings[0].querySelector(".island-bar-preview__more")?.textContent === "+1",
    "In notch mode the preview hangs from the top with the camera in the middle: left items on the left, the center pattern leading the right, no text, +N on the emptier side");
  check(document.querySelector(".collapsed-lanes__lane[data-lane='center'] .collapsed-lanes__lane-hint")?.textContent === "排在刘海右边最前"
    && document.querySelector(".collapsed-lanes__lane[data-lane='left'] .collapsed-lanes__lane-hint")?.textContent === "刘海左边",
    "The lanes say where things go around the notch");
  await notch(null);
  await overflow(null);
  check(!document.querySelector(".island-bar-preview[data-notch]") && document.querySelector(".collapsed-lanes__lane[data-lane='left'] .collapsed-lanes__lane-hint")?.textContent === "摘要左边",
    "Without a notch the bar preview and hints go back to the pill");
}

export async function checkCollapsedLanes(check: Check) {
  localStorage.removeItem("fuyu-collapsed-items");
  check(lane("left") === "浮屿水母" && lane("right").startsWith("新邮件提醒") && lane("right").endsWith("会话数 / 会话环|计时器") && off() === "外设电量" && saved() === null,
    "The lanes show the default layout without saving anything, and the peripheral battery, off by default, waits in the list below");
  await checkKeyboard(check);
  await checkButtons(check);
  await checkDrag(check);
  await checkNotch(check);
  await overflow(["session-count", "timer"]);
  check(document.querySelector(".collapsed-lanes__lane[data-lane='right'] .collapsed-lanes__fold + .lane-chip")?.getAttribute("data-item") === "session-count"
    && chip("timer")?.hasAttribute("data-spilled") && more() === "+2", "Items the island had no room for are marked after a fold line and counted in the preview's +N");
  await overflow(null);
  check(!document.querySelector(".collapsed-lanes__fold") && !more(), "The fold line goes away when the island has room again");
  await act(async () => { await (await import("@tauri-apps/api/event")).emit("plugin-bar-usage-report", { id: 1, collapsed: false, barWidth: null, items: [{ id: "weather", owner: "@fuyu/weather", hideable: true, box: null, name: "天气" }, { id: "ring", owner: "@fuyu/todo-ring", hideable: false, box: null, name: "待办环" }] }); await new Promise((resolve) => setTimeout(resolve, 50)); });
  await act(async () => { chip("weather")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })); });
  await act(async () => { document.querySelector<HTMLButtonElement>(".lane-menu [data-place='left']")!.click(); });
  check(lane("left") === "浮屿水母|天气" && !lane("right").includes("待办环") && savedItem("weather")?.zone === "left", "A plugin item the island reports is listed by name and can change sides; one that cannot be hidden is left out");
  localStorage.removeItem("fuyu-collapsed-items");
}
