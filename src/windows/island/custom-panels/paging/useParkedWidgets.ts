import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomPanel, PanelItem } from "../../../../lib/settings/customPanels";

export function useParkedWidgets(editing: boolean, panel: CustomPanel, onChange: (panel: CustomPanel) => void) {
  const [parked, setParked] = useState<PanelItem[]>([]);
  const latest = useRef({ panel, onChange, parked });
  useEffect(() => {
    latest.current = { panel, onChange, parked };
  });

  const park = useCallback((item: PanelItem) => setParked((list) => [...list.filter((other) => other.widget !== item.widget), item]), []);
  const take = useCallback((widget: string) => setParked((list) => list.filter((other) => other.widget !== widget)), []);

  const restore = useCallback(() => {
    const { panel: current, onChange: save, parked: list } = latest.current;
    if (list.length === 0) return false;
    const present = new Set(current.items.map((item) => item.widget));
    save({ ...current, items: [...current.items, ...list.filter((item) => !present.has(item.widget))] });
    latest.current = { ...latest.current, parked: [] };
    return true;
  }, []);

  useEffect(() => {
    if (!editing && restore()) setParked([]);
  }, [editing, restore]);

  useEffect(() => () => void restore(), [restore]);

  return { parked, park, take };
}
