import { act } from "react";

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

export async function checkThemeMarket(check: (condition: unknown, message: string) => void, openOverview: () => Promise<void>) {
  const titles = [...document.querySelectorAll(".editor-panel .settings-group__title")].map((title) => title.textContent);
  check(titles.slice(0, 3).join("|") === "主题|样式预设|主题市场", "The theme page starts with the themes, the style presets and the theme market");
  const moreRow = [...document.querySelectorAll<HTMLElement>(".theme-market .settings-row")].find((row) => row.querySelector(".settings-row__title")?.textContent === "更多主题");
  check(moreRow && !document.querySelector(".theme-market__item"), "The market is one More themes row and loads nothing until asked");
  await act(async () => { moreRow!.querySelector<HTMLButtonElement>("button")!.click(); });
  await settle();
  const card = (id: string) => document.querySelector<HTMLElement>(`.theme-market__item[data-theme-id="${id}"]`)!;
  const cardButton = (id: string, label: string) => [...card(id).querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === label);
  const previewFill = (id: string) => card(id).querySelector<HTMLElement>(".island-preview__island--collapsed")?.style.getPropertyValue("--preview-fill") ?? "";

  check(document.querySelectorAll(".theme-market__item").length === 3 && card("fuyu.midnight").querySelector(".island-preview--compact")
    && card("fuyu.midnight").querySelector(".plugin-market__badge--official") && card("someone.dusk").textContent?.includes("作者 someone"),
    "The theme market lists each theme with a preview, Official for the island's own");

  check(Boolean(card("fuyu.polar").querySelector(".theme-market__badge--dual")) && !card("fuyu.midnight").querySelector(".theme-market__badge--dual")
    && Boolean(card("fuyu.polar").querySelector(".theme-market__tones")),
    "A dual-tone market theme shows the Dark & light badge and tone preview switch");

  const darkFill = previewFill("fuyu.polar");
  await act(async () => { card("fuyu.polar").querySelector<HTMLButtonElement>("button[aria-label='预览浅色版本']")!.click(); });
  const lightFill = previewFill("fuyu.polar");
  check(darkFill.includes("20, 27, 38") && lightFill.includes("238, 243, 250"),
    "Switching a dual-tone card to Light previews its light palette without collapsing back to dark");

  const filterButton = (label: string) => [...document.querySelectorAll<HTMLButtonElement>(".theme-market__toolbar .settings-choice button")].find((button) => button.textContent === label);
  await act(async () => { filterButton("深浅双色")!.click(); });
  check(document.querySelectorAll(".theme-market__item").length === 1 && Boolean(document.querySelector('.theme-market__item[data-theme-id="fuyu.polar"]')),
    "Filtering by Dark & light shows only dual-tone themes");
  await act(async () => { filterButton("全部")!.click(); });

  const scaleBefore = JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}").collapsedScale;
  await act(async () => { cardButton("someone.dusk", "应用")!.click(); });
  const afterApply = JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { islandBackgroundColor?: string; collapsedScale?: number };
  check(afterApply.islandBackgroundColor === "#1b1020" && afterApply.collapsedScale === scaleBefore && cardButton("someone.dusk", "使用中")?.disabled,
    "Apply changes the look, not the size, and the card says it is in use");

  await act(async () => { cardButton("fuyu.polar", "应用")!.click(); });
  const afterDual = JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { darkBackgroundColor?: string; lightBackgroundColor?: string };
  check(afterDual.darkBackgroundColor === "#141b26" && afterDual.lightBackgroundColor === "#eef3fa" && cardButton("fuyu.polar", "使用中")?.disabled,
    "Applying a dual-tone theme writes both dark and light sets and marks it in use");

  await act(async () => { cardButton("fuyu.midnight", "保存到我的主题")!.click(); });
  check(cardButton("fuyu.midnight", "已保存")?.disabled && (localStorage.getItem("fuyu-setting-presets") ?? "").includes("午夜蓝"),
    "Save adds the theme to the saved themes");

  const themeCards = () => [...document.querySelectorAll<HTMLElement>(".settings-cards__card")].filter((card) => card.closest(".settings-group")?.querySelector(".settings-group__title")?.textContent === "主题");
  const activeCard = () => themeCards().find((card) => card.getAttribute("aria-pressed") === "true")?.querySelector(".settings-cards__label")?.textContent;
  const themeCard = (label: string) => themeCards().find((found) => found.querySelector(".settings-cards__label")?.textContent === label)!;
  await act(async () => { themeCard("灰白").click(); });
  check(activeCard() === "灰白" && themeCards().length === 8 && getComputedStyle(themeCards()[0].parentElement!).gridTemplateColumns.split(" ").length === 4,
    "The themes are the 3 built-in sets and the 5 liquid glass looks, 4 to a row, and a picked set is selected");
  await act(async () => { themeCard("Win11 Mica").click(); });
  const glassStored = JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as { appearanceMode?: string; glassBlur?: number };
  check(glassStored.appearanceMode === "liquidGlass" && glassStored.glassBlur === 60 && activeCard() === "Win11 Mica", "A liquid glass theme card switches to liquid glass with that look and is selected");
  await act(async () => { themeCard("灰白").click(); });
  await act(async () => { cardButton("someone.dusk", "应用")!.click(); });
  check(activeCard() === "自定义" && themeCards().length === 9, "Colors that match no theme card add a selected Custom card");

  const scrolled: Element[] = [];
  const scrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) { scrolled.push(this); };
  try {
    await openOverview();
    await act(async () => { [...document.querySelectorAll<HTMLButtonElement>(".settings-overview__next-tile")].find((tile) => tile.textContent?.includes("换一套主题"))!.click(); });
    await settle();
  } finally {
    Element.prototype.scrollIntoView = scrollIntoView;
  }
  check(document.querySelector<HTMLElement>(".settings-tabs__tab--active")?.dataset.tab === "theme" && scrolled.some((found) => found.classList.contains("theme-market")) && document.querySelector(".theme-market__item"),
    "The overview's theme market link opens the theme page, scrolled to the open market");
}
