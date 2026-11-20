import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { islandItemStyleMatches, islandItemStyles } from "../../../features/plugin-kernel/settingsSlots";
import { useSlotEntries } from "../../../features/plugin-kernel/useSlotEntries";
import type { IslandSettings } from "../../../lib/settings/types";
import { CollapsedItemsSection } from "../sections/CollapsedItemsSection";
import { DisplaySettingsSection } from "../sections/DisplaySettingsSection";
import { CENTER_ITEMS } from "./centerItems";
import { firstListedMatch } from "./itemPlace";
import { ExpandedLayout } from "./ExpandedLayout";
import { IslandBarPreview } from "./IslandBarPreview";
import { onIslandLayoutItem, takeIslandLayoutItem } from "./islandLayoutFocus";
import { LayoutStage, type LayoutMode } from "./LayoutStage";
import { useCollapsedLayout } from "./useCollapsedLayout";

const FOUND_MS = 1_600;

export function IslandLayoutPage({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const layout = useCollapsedLayout();
  const { names, listed, placements } = layout;
  const styles = useSlotEntries(islandItemStyles, "islandLayout");
  const centers = useMemo(() => CENTER_ITEMS.filter((item) => styles.some((entry) => islandItemStyleMatches(entry.id, item))), [styles]);
  const [mode, setMode] = useState<LayoutMode>("bar");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [wanted, setWanted] = useState<{ item: string; at: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const pick = useCallback((item: string) => {
    setMode("bar");
    setOpenItem(item);
    setWanted({ item, at: Date.now() });
  }, []);

  useEffect(() => {
    const focus = (item: string) => {
      const target = CENTER_ITEMS.includes(item) ? item : firstListedMatch(listed, item);
      if (target) pick(target);
    };
    const pending = takeIslandLayoutItem();
    if (pending) focus(pending);
    return onIslandLayoutItem(() => {
      const item = takeIslandLayoutItem();
      if (item) focus(item);
    });
  }, [listed, pick]);

  useEffect(() => {
    if (!wanted) return;
    const row = [...(root.current?.querySelectorAll<HTMLElement>(".collapsed-items__item") ?? [])].find((element) => element.dataset.item === wanted.item);
    if (!row) return;
    row.scrollIntoView({ block: "center" });
    row.classList.add("collapsed-items__item--found");
    const timer = window.setTimeout(() => row.classList.remove("collapsed-items__item--found"), FOUND_MS);
    return () => {
      window.clearTimeout(timer);
      row.classList.remove("collapsed-items__item--found");
    };
  }, [wanted]);

  const stage = (preview: ReactNode) => (
    <LayoutStage mode={mode} onMode={setMode}>
      {preview}
    </LayoutStage>
  );

  return (
    <div className="island-layout" ref={root} data-mode={mode}>
      {mode === "bar" ? (
        <>
          {stage(<IslandBarPreview settings={settings} names={names} placements={placements} centers={centers} openItem={openItem} onPick={pick} />)}
          <CollapsedItemsSection layout={layout} settings={settings} onSettingsChange={onSettingsChange} openItem={openItem} onOpenItem={setOpenItem} />
          <DisplaySettingsSection settings={settings} onSettingsChange={onSettingsChange} />
        </>
      ) : (
        <ExpandedLayout settings={settings} pluginPages={layout.pluginPages} pluginWidgets={layout.pluginWidgets} stage={stage} />
      )}
    </div>
  );
}
