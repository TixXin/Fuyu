import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "../../i18n";
import { MOTION_SLOW_MS } from "../../lib/theme/motionTokens";
import { PAGE_ARROW_PULSE_EVENT, type PageArrowSide } from "../island/pageArrows";
import type { SideDockPageEntry } from "./sideDockMeta";
import "./SideDockPageArrows.css";

type Pulse = { side: PageArrowSide; seq: number; flash: boolean };

type SideDockPageArrowsProps = {
  dockPages: readonly SideDockPageEntry[];
  currentId: string | null;
  labelFor: (entry: SideDockPageEntry) => string;
  onSelectPage: (pageId: string) => void;
};

export function SideDockPageArrows({ dockPages, currentId, labelFor, onSelectPage }: SideDockPageArrowsProps) {
  const t = useTranslation();
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

  if (dockPages.length < 2) return null;

  const index = Math.max(0, dockPages.findIndex((entry) => entry.id === currentId));
  const previous = dockPages[(index - 1 + dockPages.length) % dockPages.length];
  const next = dockPages[(index + 1) % dockPages.length];

  const renderArrow = (side: PageArrowSide, target: SideDockPageEntry) => {
    const active = pulse?.side === side ? pulse : null;
    const Icon = side === "previous" ? ChevronLeft : ChevronRight;
    return (
      <button
        type="button"
        tabIndex={-1}
        className={`sd-page-arrow sd-page-arrow--${side}${active?.flash ? " sd-page-arrow--flash" : ""}`}
        aria-label={t.island.pageArrow[side](labelFor(target))}
        onClick={(event) => {
          event.stopPropagation();
          onSelectPage(target.id);
          setPulse((current) => ({ side, seq: (current?.seq ?? 0) + 1, flash: false }));
        }}
      >
        <span key={active?.seq ?? 0} className={`sd-page-arrow__icon${active ? " sd-page-arrow__icon--nudge" : ""}`}>
          <Icon size={15} strokeWidth={2.2} absoluteStrokeWidth aria-hidden="true" />
        </span>
      </button>
    );
  };

  return (
    <>
      {renderArrow("previous", previous)}
      {renderArrow("next", next)}
    </>
  );
}
