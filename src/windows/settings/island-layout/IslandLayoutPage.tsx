import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { islandItemStyleMatches, islandItemStyles } from "../../../features/plugin-kernel/settingsSlots";
import { useSlotEntries } from "../../../features/plugin-kernel/useSlotEntries";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";
import { useIslandNotchShown } from "../useIslandNotchShown";
import { CENTER_ITEMS } from "./centerItems";
import { CollapsedLanes } from "./CollapsedLanes";
import { laneOf } from "./laneMoves";
import { ItemStyleTabs } from "./ItemStyleTabs";
import { firstListedMatch } from "./itemPlace";
import { IslandBarPreview } from "./IslandBarPreview";
import { onIslandLayoutItem, takeIslandLayoutItem } from "./islandLayoutFocus";
import { LayoutStage } from "./LayoutStage";
import { useBarMirror } from "./useBarMirror";
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
  const notch = useIslandNotchShown();
  const mirror = useBarMirror();
  const text = useTranslation().settings.collapsedItems;
  const styles = useSlotEntries(islandItemStyles, "islandLayout");
  const styled = useCallback((item: string) => styles.some((entry) => islandItemStyleMatches(entry.id, item)), [styles]);
  const centers = useMemo(() => CENTER_ITEMS.filter(styled), [styled]);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [wanted, setWanted] = useState<{ item: string; at: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState(0);

  const pick = useCallback((item: string) => {
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

  return (
    <div className="island-layout" ref={root} data-mode="bar">
      <LayoutStage mode="bar">
        <IslandBarPreview
          settings={settings}
          notch={notch}
          mirror={mirror}
          names={names}
          placements={editor.view}
          centers={centers}
          openItem={openItem}
          drag={editor.drag}
          onPick={pick}
          onDragStart={editor.startDrag}
        />
      </LayoutStage>
      <CollapsedLanes layout={layout} editor={editor} notch={notch} frame={mirror.view?.live ? mirror.view.frame : null} centers={centers} styled={styled} selected={openItem} onSelect={setOpenItem} onStyle={showStyle} />
      <ItemStyleTabs items={styleItems} current={openItem} onPick={setOpenItem} settings={settings} onSettingsChange={onSettingsChange} />
    </div>
  );
}
