import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useTranslation } from "../../i18n";
import { MOTION_SLOW_MS } from "../../lib/theme/motionTokens";
import { cycleShortcutPage, type IslandFeatures } from "./features";
import { PAGE_ARROW_PULSE_EVENT, type PageArrowSide } from "./pageArrows";
import { pageSlot } from "./slots/pageSlot";
import type { IslandPage } from "./types";
import { usePageLabel } from "./usePageLabel";
import "./IslandPageArrows.css";

type Pulse = { side: PageArrowSide; seq: number; flash: boolean };

export function IslandPageArrows({ features, page, onPageChange }: {
  features: IslandFeatures;
  page: IslandPage;
  onPageChange: (page: IslandPage) => void;
}) {
  const t = useTranslation();
  const { pageLabel } = usePageLabel();
  const entries = useSlotEntries(pageSlot);
  const [pulse, setPulse] = useState<Pulse | null>(null);

  useEffect(() => {
    const onPulse = (event: Event) => {
      const side = (event as CustomEvent<unknown>).detail;
      if (side !== "previous" && side !== "next") return;
      setPulse((current) => ({ side, seq: (current?.seq ?? 0) + 1, flash: true }));
    };
    window.addEventListener(PAGE_ARROW_PULSE_EVENT, onPulse);
    return () => window.removeEventListener(PAGE_ARROW_PULSE_EVENT, onPulse);
  }, []);

  useEffect(() => {
    if (!pulse?.flash) return;
    const timer = window.setTimeout(() => setPulse((current) => (current ? { ...current, flash: false } : current)), MOTION_SLOW_MS);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  const previous = cycleShortcutPage(features, page, -1);
  const next = cycleShortcutPage(features, page, 1);
  if (!previous || !next) return null;

  const labelOf = (id: IslandPage) => {
    const entry = entries.find((item) => item.id === id);
    return entry ? pageLabel(entry) : id;
  };
  const arrow = (side: PageArrowSide, target: IslandPage) => {
    const active = pulse?.side === side ? pulse : null;
    const Icon = side === "previous" ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        tabIndex={-1}
        className={`island-page-arrow island-page-arrow--${side}${active?.flash ? " island-page-arrow--flash" : ""}`}
        aria-label={t.island.pageArrow[side](labelOf(target))}
        onClick={(event) => {
          event.stopPropagation();
          onPageChange(target);
          setPulse((current) => ({ side, seq: (current?.seq ?? 0) + 1, flash: false }));
        }}
      >
        <span key={active?.seq ?? 0} className={`island-page-arrow__icon${active ? " island-page-arrow__icon--nudge" : ""}`}>
          <Icon size={16} strokeWidth={2.2} absoluteStrokeWidth aria-hidden="true" />
        </span>
      </button>
    );
  };

  return (
    <>
      {arrow("previous", previous)}
      {arrow("next", next)}
    </>
  );
}
