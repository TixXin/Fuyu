import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isMacOS } from "../../lib/platform";

const SEARCH_INPUT = ".settings-sidebar__search input";
const MODAL_DIALOG = "[role='dialog'][aria-modal='true']";

export function useSettingsWindowKeys() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return;
      const failed = (error: unknown) => console.error("Settings window key failed", error);
      if (event.key === "Escape") {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.repeat) return;
        if (document.querySelector(MODAL_DIALOG)) return;
        event.preventDefault();
        void getCurrentWindow().close().catch(failed);
        return;
      }
      if (!isMacOS || !event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "w") {
        event.preventDefault();
        void getCurrentWindow().close().catch(failed);
      } else if (key === "m") {
        event.preventDefault();
        void getCurrentWindow().minimize().catch(failed);
      } else if (key === "f") {
        const search = document.querySelector<HTMLInputElement>(SEARCH_INPUT);
        if (!search) return;
        event.preventDefault();
        search.focus();
        search.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
