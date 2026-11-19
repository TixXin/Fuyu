import { act } from "react";
import { emit } from "@tauri-apps/api/event";

async function until(condition: () => unknown) {
  for (let tries = 0; tries < 60; tries += 1) {
    if (condition()) return true;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
  return false;
}

export async function checkNotchPreview(check: (condition: unknown, message: string) => void) {
  const collapsed = () => document.querySelector<HTMLElement>(".island-preview__island--collapsed");
  const glassy = () => Boolean(collapsed()?.querySelector(".island-preview__flow"));
  const black = () => getComputedStyle(collapsed()!).backgroundColor === "rgb(0, 0, 0)";
  check(glassy(), "Without a notch the collapsed preview shows the liquid glass");
  await act(async () => { await emit("island-notch-changed", { width: 200, height: 32 }); });
  check(await until(() => black() && !glassy()) && !collapsed()?.querySelector(".island-preview__task"),
    "While the island sits in the notch the collapsed preview is a plain black bar without the title, like the island");
  check(document.querySelector(".island-preview__island--expanded .island-preview__flow") || !document.querySelector(".island-preview__island--expanded"),
    "The expanded preview keeps the theme");
  await act(async () => { await emit("island-notch-changed", null); });
  check(await until(glassy), "Leaving the notch brings the themed collapsed preview back");
}
