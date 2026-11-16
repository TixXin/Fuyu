import { act } from "react";

export async function checkGlassLooks(check: (condition: unknown, message: string) => void) {
  check(!document.querySelector(".island-preview__island--glass"), "The island preview starts classic");
  const glassButton = [...document.querySelectorAll<HTMLButtonElement>(".editor-panel button")].find((button) => button.textContent === "液态玻璃");
  await act(async () => { glassButton!.click(); });
  check(document.querySelectorAll(".island-preview__island--glass").length === 2, "Choosing liquid glass shows on both preview islands");
  const glassStored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;
  const lookButton = () => document.querySelector<HTMLButtonElement>(".settings-select button[aria-label='预设']");
  check(lookButton()?.textContent?.includes("流彩毛玻璃"), "The liquid glass defaults show as the Frosted flow preset");
  const colorsBefore = { background: glassStored().islandBackgroundColor, accent: glassStored().accentColor, corner: glassStored().islandCornerRadius };
  await act(async () => { lookButton()!.click(); });
  await act(async () => { document.querySelector<HTMLElement>(".select-control__option[data-value='mica']")!.click(); });
  check(glassStored().glassBlur === 60 && glassStored().glassSaturation === 130 && glassStored().glassIntensity === 72 && glassStored().glassStyle === "static"
    && glassStored().glassContrastGuard === false && lookButton()?.textContent?.includes("Win11 Mica"), "Picking Mica saves its glass values and shows it as the preset");
  check(glassStored().islandBackgroundColor === colorsBefore.background && glassStored().accentColor === colorsBefore.accent && glassStored().islandCornerRadius === colorsBefore.corner,
    "A glass preset leaves the colours and corners alone");
  const sheen = [...document.querySelectorAll<HTMLElement>(".settings-row")].find((row) => row.querySelector(".settings-row__title")?.textContent === "扫光");
  await act(async () => { sheen!.querySelector<HTMLElement>("[role='switch'], input")!.click(); });
  check(glassStored().glassSheen === true && lookButton()?.textContent?.includes("自定义"), "Changing one glass setting turns the preset into Custom");
  await act(async () => { [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "恢复液态玻璃默认")!.click(); });
  check(lookButton()?.textContent?.includes("流彩毛玻璃"), "Restoring the liquid glass defaults shows Frosted flow again");
}
