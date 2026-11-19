import type { SettingsPluginPageText } from "../../src/i18n/sections/settings/pluginPage";
import type { BarUsageView } from "../../src/windows/settings/usePluginBarUsage";
import type { PluginStatusV3 } from "../../src/windows/settings/usePluginHostStatus";
import { PLUGIN } from "./pluginPageMocks";

export const ON_BAR: PluginStatusV3[] = [PLUGIN.weather, PLUGIN.clock, { ...PLUGIN.pomodoro, state: "disabled" }, PLUGIN.local, PLUGIN.gadget];
const BAR_ITEMS = [
  { id: "weather", owner: "@fuyu/weather", hideable: true, box: { left: 300, width: 64, wanted: 64, clipped: false } },
  { id: "clock", owner: "@someone/clock", hideable: true, box: { left: 372, width: 30, wanted: 58, clipped: true } },
  { id: "tool", owner: "my-local-tool", hideable: true, box: null },
];
export const BAR: BarUsageView = { report: { id: 1, collapsed: true, barWidth: 412, items: BAR_ITEMS }, stale: false };
export const BAR_OPEN: BarUsageView = { report: { id: 2, collapsed: false, barWidth: null, items: BAR_ITEMS.map((item) => ({ ...item, box: null })) }, stale: false };

export interface BarCheckTools {
  check: (condition: unknown, message: string) => void;
  click: (element: Element | null | undefined) => Promise<void>;
  press: (element: Element, key: string) => Promise<void>;
  settle: (ms?: number) => Promise<void>;
  within: (key: string, selector: string) => HTMLElement | null;
  all: (key: string, selector: string) => HTMLElement[];
  dialog: (id: string) => HTMLElement | null;
  opened: readonly string[];
  text: SettingsPluginPageText["bar"];
  plain: readonly string[];
}

export async function checkBarUsage({ check, click, press, settle, within, all, dialog, opened, text: tb, plain }: BarCheckTools) {
  const barRow = (key: string, id: string) => within(key, `[data-bar-row='${id}']`);
  const barAction = (key: string, id: string, action: string) => barRow(key, id)?.querySelector<HTMLButtonElement>(`[data-bar-action='${action}']`);
  const savedBar = () => (JSON.parse(localStorage.getItem("fuyu-collapsed-items") ?? "{}") as { items?: { id: string; zone: string; hidden?: boolean }[] }).items ?? [];
  check(plain.every((key) => !within(key, "[data-bar-usage]")), "Bar usage: nothing is drawn until the island has answered");
  const segs = all("bar", "[data-bar-seg]");
  const [weatherSeg, clockSeg] = segs;
  check(segs.length === 2 && segs.map((seg) => seg.dataset.barSeg).join() === "weather,clock" && Math.abs(parseFloat(weatherSeg.style.left) - (300 / 412) * 100) < 0.1 && Math.abs(parseFloat(weatherSeg.style.width) - (64 / 412) * 100) < 0.1, "Bar usage: each plugin item on the bar is drawn at its measured position and width");
  check(all("bar", "[data-bar-row]").map((item) => `${item.dataset.barRow}:${item.dataset.state}`).join() === "weather:shown,clock:clipped,tool:idle,plugin:@fuyu/pomodoro:off", "and the list follows the bar from left to right, then what is not showing");
  check(barRow("bar", "weather")?.textContent!.includes(tb.width(64)) && barRow("bar", "clock")?.textContent!.includes(tb.state.clipped(28)) && barRow("bar", "tool")?.textContent!.includes(tb.state.idle) && barRow("bar", "plugin:@fuyu/pomodoro")?.textContent!.includes(tb.state.off), "Each row says how wide it is or why it is not showing");
  check(within("bar", "[data-bar-summary]")?.textContent!.includes(tb.summary(2, 94, 412)) && within("bar", "[data-bar-clipped]")?.textContent === tb.clipped(1) && within("bar", "[data-bar-why]")?.textContent === tb.cap(520), "The heading totals the widths, and an item that does not fit comes with the reason");
  check(barRow("bar", "plugin:@fuyu/pomodoro")?.querySelector<HTMLButtonElement>(".plugin-bar__row")?.disabled === true && !within("bar", "[data-bar-actions]"), "A plugin that is off has nothing to adjust, and no row is open at first");
  await click(clockSeg);
  check(barRow("bar", "clock")?.querySelector(".plugin-bar__row")?.getAttribute("aria-expanded") === "true" && barAction("bar", "clock", "left")?.disabled === false && barAction("bar", "clock", "right")?.disabled === true, "Clicking a segment opens that item's actions; the last item cannot move further right");
  await click(barAction("bar", "clock", "left"));
  check(savedBar().map((item) => item.id).join() === "clock,weather,tool" && opened.includes("bar:bar-changed"), "Move left writes the collapsed bar layout with the two items swapped and asks the island again");
  await click(barAction("bar", "clock", "right"));
  check(savedBar().map((item) => item.id).join() === "weather,clock,tool", "and Move right puts it back");
  await click(barAction("bar", "clock", "hide"));
  check(savedBar().find((item) => item.id === "clock")?.hidden === true && barRow("bar", "clock")?.dataset.state === "hidden" && barRow("bar", "clock")?.textContent!.includes(tb.state.hidden) && all("bar", "[data-bar-seg]").length === 1 && !within("bar", "[data-bar-clipped]"), "Taking an item off the bar hides it in the layout and the row says the user did it");
  check(barAction("bar", "clock", "show")?.textContent === tb.actions.show && !barAction("bar", "clock", "left") && !barAction("bar", "clock", "zone"), "A hidden item only offers to come back");
  await click(barAction("bar", "clock", "show"));
  check(!savedBar().some((item) => item.hidden) && barRow("bar", "clock")?.dataset.state === "clipped", "and putting it back restores it");
  await click(barRow("bar", "clock")?.querySelector(".plugin-bar__row"));
  await click(barRow("bar", "weather")?.querySelector(".plugin-bar__row"));
  await click(barAction("bar", "weather", "zone"));
  check(savedBar().find((item) => item.id === "weather")?.zone === "left" && barRow("bar", "weather")?.textContent!.includes(tb.side.left) && barAction("bar", "weather", "zone")?.textContent === tb.actions.toRight, "An item can move to the other side of the bar");
  await click(barAction("bar", "weather", "zone"));
  await click(barAction("bar", "weather", "settings"));
  await settle();
  check(dialog("@fuyu/weather")?.querySelector("[data-tab='settings']")?.getAttribute("aria-selected") === "true", "and its row opens the plugin's settings");
  await press([...document.querySelectorAll<HTMLElement>("[data-plugin-detail='@fuyu/weather']")].pop()!, "Escape");
  await click(barRow("bar", "weather")?.querySelector(".plugin-bar__row"));
  await click(within("narrow-bar", "[data-bar-seg='clock']"));
  const barSpills = all("narrow-bar", ".plugin-bar, .plugin-bar__map, .plugin-bar__row, .plugin-bar__actions, .plugin-bar__note").filter((element) => element.scrollWidth > element.clientWidth + 1);
  check(barAction("narrow-bar", "clock", "hide") && barSpills.length === 0, barSpills.length ? `Narrow: ${barSpills.map((element) => element.className).join(", ")} spill out sideways at 340 px` : "Narrow: the bar drawing, its rows and an open row's actions fit in 340 px");
  await click(within("narrow-bar", "[data-bar-seg='clock']"));
  localStorage.removeItem("fuyu-collapsed-items");
  check(!within("bar-open", "[data-bar-map]") && within("bar-open", "[data-bar-note]")?.textContent === tb.expanded && all("bar-open", "[data-bar-row]").map((item) => item.dataset.state).join() === "unmeasured,unmeasured,unmeasured,off", "While the island is open and was never measured, the items are listed without a drawing");
}
