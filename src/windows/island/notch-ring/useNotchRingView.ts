import { useMemo } from "react";
import { notchRingLook, type NotchRingSettingValues } from "../../../lib/settings/notchRingSettings";
import { usePageHidden } from "../../../lib/usePageHidden";
import type { NotchRingView } from "./NotchRing";

const DEFAULT_ACCENT = "var(--color-accent, #74d6ff)";

export function useNotchRingView(settings: NotchRingSettingValues, accentColor: string | null, quiet: boolean): NotchRingView | null {
  const accent = accentColor ?? DEFAULT_ACCENT;
  const hidden = usePageHidden();
  const island = useMemo(() => notchRingLook(settings, "Island"), [settings]);
  const panel = useMemo(() => notchRingLook(settings, "Panel"), [settings]);
  const used = [island, panel].some((look) => look.style !== "off" || look.device || look.status);
  return useMemo(() => (used ? { island, panel, accent, paused: quiet || hidden } : null), [used, island, panel, accent, quiet, hidden]);
}
