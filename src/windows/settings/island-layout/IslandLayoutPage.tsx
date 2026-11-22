import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { islandItemStyleMatches, islandItemStyles } from "../../../features/plugin-kernel/settingsSlots";
import { useSlotEntries } from "../../../features/plugin-kernel/useSlotEntries";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { DisplaySettingsSection } from "../sections/DisplaySettingsSection";
import { CENTER_ITEMS } from "./centerItems";
import { CollapsedLanes } from "./CollapsedLanes";
import { laneOf } from "./laneMoves";
import { ItemStyleTabs } from "./ItemStyleTabs";
import { firstListedMatch } from "./itemPlace";
import { ExpandedLayout } from "./ExpandedLayout";
import { IslandBarPreview } from "./IslandBarPreview";
import { onIslandLayoutItem, takeIslandLayoutItem } from "./islandLayoutFocus";
import { LayoutStage, type LayoutMode } from "./LayoutStage";
import { useCollapsedEditor } from "./useCollapsedEditor";
import { useCollapsedLayout } from "./useCollapsedLayout";

const FOUND_MS = 1_600;

export function IslandLayoutPage({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const layout = useCollapsedLayout();
  const { names, listed } = layout;
  const editor = useCollapsedEditor(layout);
  const text = useTranslation().settings.collapsedItems;
  const styles = useSlotEntries(islandItemStyles, "islandLayout");
  const styled = useCallback((item: string) => styles.some((entry) => islandItemStyleMatches(entry.id, item)), [styles]);
  const centers = useMemo(() => CENTER_ITEMS.filter(styled), [styled]);
  const [mode, setMode] = useState<LayoutMode>("bar");
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [wanted, setWanted] = useState<{ item: string; at: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(0);

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
    const chip = [...(root.current?.querySelectorAll<HTMLElement>(".lane-chip") ?? [])].find((element) => element.dataset.item === wanted.item);
    if (!chip) return;
    chip.scrollIntoView({ block: "center" });
    chip.classList.add("lane-chip--found");
    const timer = window.setTimeout(() => chip.classList.remove("lane-chip--found"), FOUND_MS);
    return () => {
      window.clearTimeout(timer);
      chip.classList.remove("lane-chip--found");
    };
  }, [wanted]);

  useEffect(() => {
    if (!flash) return;
    const panel = root.current?.querySelector<HTMLElement>(".lane-styles");
    if (!panel) return;
    panel.scrollIntoView({ block: "nearest" });
    panel.classList.add("lane-styles--flash");
    const timer = window.setTimeout(() => panel.classList.remove("lane-styles--flash"), FOUND_MS);
    return () => {
      window.clearTimeout(timer);
      panel.classList.remove("lane-styles--flash");
    };
  }, [flash]);

  const showStyle = useCallback((item: string) => {
    setOpenItem(item);
    setFlash(Date.now());
  }, []);

  const styleItems = useMemo(() => {
    const where = (id: string) => {
      const placement = editor.view.find((item) => item.id === id);
      return placement ? text.lanes.name[laneOf(placement)] : text.lanes.name.center;
    };
    const centerName: Record<string, string> = { center: text.item.center, "todos-count": text.item.todoCount };
    return [...centers.map((id) => ({ id, name: centerName[id] ?? id })), ...listed.filter(styled).map((id) => ({ id, name: names.get(id) ?? id }))]
      .map((item) => ({ ...item, place: where(item.id) }));
  }, [centers, editor.view, listed, names, styled, text]);

  const stage = (preview: ReactNode) => (
    <LayoutStage mode={mode} onMode={setMode}>
      {preview}
    </LayoutStage>
  );

  return (
    <div className="island-layout" ref={root} data-mode={mode}>
      {mode === "bar" ? (
        <>
          {stage(
            <IslandBarPreview
              settings={settings}
              names={names}
              placements={editor.view}
              centers={centers}
              openItem={openItem}
              dragging={editor.drag?.id ?? null}
              onPick={pick}
              onDragStart={editor.startDrag}
            />,
          )}
          <CollapsedLanes layout={layout} editor={editor} centers={centers} styled={styled} selected={openItem} onSelect={setOpenItem} onStyle={showStyle} />
          <ItemStyleTabs items={styleItems} current={openItem} onPick={setOpenItem} settings={settings} onSettingsChange={onSettingsChange} />
          <DisplaySettingsSection settings={settings} onSettingsChange={onSettingsChange} />
        </>
      ) : (
        <ExpandedLayout settings={settings} pluginPages={layout.pluginPages} pluginWidgets={layout.pluginWidgets} stage={stage} />
      )}
    </div>
  );
}
