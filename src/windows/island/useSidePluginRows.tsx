import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Blocks } from "lucide-react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { packageIconUrl } from "../../features/plugin-kernel/packageIconUrl";
import { PLUGIN_BASE } from "../../features/plugin-kernel/pluginBase";
import { usePluginIcons } from "../../features/plugin-kernel/pluginNames";
import { isCollapsedItemHidden } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { collapsedOpensTarget } from "./collapsedOpens";
import { collapsedBarSlot, type CollapsedBarContext } from "./slots/collapsed";
import { pageSlot } from "./slots/pageSlot";
import { SIDE_ROW_HEIGHT } from "./sideColumn";
import { useCollapsedItemNames } from "./useCollapsedItemNames";
import type { SideColumnRow } from "./IslandSideColumn";
import type { IslandPage } from "./types";

type SidePluginRows = { rows: readonly SideColumnRow[]; probes: ReactNode };

const NONE: SidePluginRows = { rows: [], probes: null };

function SidePluginCell({ label, icon, page, onOpenPage }: { label: string; icon: string | null; page: IslandPage | null; onOpenPage: (page: IslandPage) => void }) {
  return (
    <button
      type="button"
      className="island-side-cell island-side-plugin"
      aria-label={label}
      data-tooltip={label}
      onClick={(event) => {
        if (page === null) return;
        event.stopPropagation();
        onOpenPage(page);
      }}
    >
      {icon ? <img src={icon} alt="" draggable={false} /> : <Blocks size={16} strokeWidth={1.6} aria-hidden="true" />}
    </button>
  );
}

function SideProbe({ id, onPresence, children }: { id: string; onPresence: (id: string, present: boolean) => void; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => onPresence(id, element.offsetWidth > 0 && element.offsetHeight > 0);
    measure();
    if (typeof ResizeObserver === "undefined") return () => onPresence(id, false);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      onPresence(id, false);
    };
  }, [id, onPresence]);
  return (
    <span ref={ref} className="island-side-probe__item">
      {children}
    </span>
  );
}

export function useSidePluginRows(active: boolean, onOpenPage: (page: IslandPage) => void): SidePluginRows {
  const t = useTranslation();
  const { hints } = useIslandContributed();
  const { placements } = useCollapsedPlacements();
  const entries = useSlotEntries(collapsedBarSlot);
  const pages = useSlotEntries(pageSlot);
  const iconPaths = usePluginIcons();
  const nameOf = useCollapsedItemNames();
  const [present, setPresent] = useState<ReadonlySet<string>>(() => new Set());
  const onPresence = useCallback((id: string, on: boolean) => {
    setPresent((before) => {
      if (before.has(id) === on) return before;
      const next = new Set(before);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const context = useMemo<CollapsedBarContext>(
    () => ({ t, statusLight: null, hints, slots: {}, onOpenPage, onOpenSettings: openSettingsWindow }),
    [t, hints, onOpenPage],
  );

  const candidates = useMemo(() => {
    if (!active) return [];
    return entries.filter((entry) => {
      if (!entry.external || entry.group === "gauges" || isCollapsedItemHidden(placements, entry.id)) return false;
      try {
        return entry.shown?.(context) ?? true;
      } catch {
        return false;
      }
    });
  }, [active, entries, placements, context]);

  return useMemo(() => {
    if (candidates.length === 0) return NONE;
    const rows: SideColumnRow[] = [];
    for (const entry of candidates) {
      if (!present.has(entry.id)) continue;
      const { page } = collapsedOpensTarget(entry, pages);
      const icon = packageIconUrl(PLUGIN_BASE, entry.owner, iconPaths.get(entry.owner));
      rows.push({
        id: `plugin-bar:${entry.id}`,
        height: SIDE_ROW_HEIGHT,
        node: <SidePluginCell label={nameOf(entry.id)} icon={icon} page={page as IslandPage | null} onOpenPage={onOpenPage} />,
      });
    }
    const probes = (
      <span className="island-side-probe" aria-hidden="true" inert>
        {candidates.map((entry) => (
          <SideProbe key={entry.id} id={entry.id} onPresence={onPresence}>
            <SlotView slot={collapsedBarSlot} props={context} select={(all) => all.filter((item) => item.id === entry.id)} />
          </SideProbe>
        ))}
      </span>
    );
    return { rows, probes };
  }, [candidates, present, pages, iconPaths, nameOf, onOpenPage, onPresence, context]);
}
