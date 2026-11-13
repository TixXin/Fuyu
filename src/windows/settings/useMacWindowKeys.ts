import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isMacOS } from "../../lib/platform";

const SEARCH_INPUT = ".settings-sidebar__search input";

export function useMacWindowKeys() {
  useEffect(() => {
    if (!isMacOS) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.isComposing) return;
      const key = event.key.toLowerCase();
      const failed = (error: unknown) => console.error("Settings window key failed", error);
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
