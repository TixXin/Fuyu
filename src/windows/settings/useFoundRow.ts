import { useEffect, type RefObject } from "react";
import type { SettingsCategory } from "./categories";
import { normalizeSearchText } from "./settingsSearch";

export type FoundRow = { page: SettingsCategory; title: string; at: number };

const FOUND_CLASS = "settings-row--found";
const MARK_MS = 1_900;
const LOOK_EVERY_MS = 50;
const LOOK_TRIES = 40;

export function useFoundRow(found: FoundRow | null, category: SettingsCategory, panel: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!found || found.page !== category) return;
    const wanted = normalizeSearchText(found.title);
    let tries = 0;
    let timer: number | undefined;
    let marked: HTMLElement | undefined;
    const look = () => {
      const row = [...(panel.current?.querySelectorAll<HTMLElement>(".settings-row") ?? [])].find(
        (candidate) => normalizeSearchText(candidate.querySelector(".settings-row__title")?.textContent ?? "") === wanted,
      );
      if (!row) {
        if (++tries < LOOK_TRIES) timer = window.setTimeout(look, LOOK_EVERY_MS);
        return;
      }
      marked = row;
      row.classList.remove(FOUND_CLASS);
      void row.offsetWidth;
      row.classList.add(FOUND_CLASS);
      row.scrollIntoView({ block: "center" });
      timer = window.setTimeout(() => row.classList.remove(FOUND_CLASS), MARK_MS);
    };
    look();
    return () => {
      window.clearTimeout(timer);
      marked?.classList.remove(FOUND_CLASS);
    };
  }, [found, category, panel]);
}
