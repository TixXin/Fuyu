import { act } from "react";

export async function checkThemeMarket(check: (condition: unknown, message: string) => void) {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
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
}
