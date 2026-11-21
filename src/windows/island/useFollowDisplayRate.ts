import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { setFollowDisplayRate } from "../../lib/display-rate/api";
import { isMacOS } from "../../lib/platform";

const RELEASE_AFTER_MS = 700;

export function useFollowDisplayRate(active: boolean) {
  useEffect(() => {
    if (!isMacOS || !isTauri()) return;
    if (active) {
      void setFollowDisplayRate(true).catch(() => {});
      return;
    }
    const timer = window.setTimeout(() => {
      void setFollowDisplayRate(false).catch(() => {});
    }, RELEASE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [active]);
}
