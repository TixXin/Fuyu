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
