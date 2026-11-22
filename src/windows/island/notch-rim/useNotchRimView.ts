import { useMemo } from "react";
import { notchRimLook, type NotchRimSettingValues } from "../../../lib/settings/notchRimSettings";
import { usePageHidden } from "../../../lib/usePageHidden";
import type { NotchRimView } from "./NotchRim";

const DEFAULT_ACCENT = "var(--color-accent, #74d6ff)";

export function useNotchRimView(settings: NotchRimSettingValues, accentColor: string | null, quiet: boolean): NotchRimView | null {
  const accent = accentColor ?? DEFAULT_ACCENT;
  const hidden = usePageHidden();
  const island = useMemo(() => notchRimLook(settings, "Island"), [settings]);
  const panel = useMemo(() => notchRimLook(settings, "Panel"), [settings]);
  const used = [island, panel].some((look) => look.style !== "off" || look.status);
  return useMemo(() => (used ? { island, panel, accent, paused: quiet || hidden } : null), [used, island, panel, accent, quiet, hidden]);
}
