import { act } from "react";

export async function checkIdleDimSettings(check: (condition: unknown, message: string) => void) {
  const row = (title: string) =>
    [...document.querySelectorAll<HTMLElement>(".settings-row")].find(
      (item) => item.querySelector(".settings-row__title")?.textContent === title,
    );
  const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;

  const islandOpacitySlider = row("整体不透明度")?.querySelector<HTMLInputElement>("input[type='range']");
  check(islandOpacitySlider?.value === "100", "Whole-island opacity starts at 100%");
  const setRange = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  await act(async () => {
    setRange.call(islandOpacitySlider, "75");
    islandOpacitySlider!.dispatchEvent(new Event("input", { bubbles: true }));
    islandOpacitySlider!.dispatchEvent(new Event("change", { bubbles: true }));
  });
  check(
    stored().islandOpacity === 75 &&
      document.querySelector<HTMLElement>(".island-preview__island--collapsed")?.style.opacity === "0.75",
    "Adjusting whole-island opacity saves it and updates the preview island",
  );
  await act(async () => {
    setRange.call(islandOpacitySlider, "100");
    islandOpacitySlider!.dispatchEvent(new Event("input", { bubbles: true }));
    islandOpacitySlider!.dispatchEvent(new Event("change", { bubbles: true }));
  });

  const dimSwitch = () => row("闲置时自动变淡")?.querySelector<HTMLElement>("[role='switch'], input");
  check(Boolean(dimSwitch()) && !row("闲置多久后变淡") && !row("变淡后不透明度"), "Idle dimming is off by default and hides its child rows");
  await act(async () => {
    dimSwitch()!.click();
  });
  check(
    stored().idleDim === true && Boolean(row("闲置多久后变淡")) && row("变淡后不透明度")?.querySelector<HTMLInputElement>("input[type='range']")?.value === "35",
    "Turning idle dimming on saves it and reveals the duration and dimmed opacity controls",
  );
  await act(async () => {
    dimSwitch()!.click();
  });
  check(stored().idleDim === false && !row("闲置多久后变淡"), "Turning idle dimming back off hides its child rows");
}
