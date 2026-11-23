import { useEffect } from "react";
import { trayMarkAlpha } from "../../components/jellyfish/pixel/trayMark.ts";
import { isMacOS } from "../../lib/platform";
import type { JellyfishStyle } from "../../lib/settings/types";
import { setTrayMark } from "./api";

export function useTrayMark(style: JellyfishStyle) {
  useEffect(() => {
    if (!isMacOS) return;
    setTrayMark(style === "vector" ? null : trayMarkAlpha(style)).catch((error: unknown) => console.error("Failed to set the menu bar icon", error));
  }, [style]);
}
