import { useEffect, useMemo, useRef } from "react";
import { sideDockEnabledSides, type SideDockEdge } from "../../lib/settings/sideDocks";
import { useSideDocks } from "../../lib/settings/useSideDocks";
import { setSideDockVisible, syncSideDock } from "./api";
import { sideDockWindowSize } from "./dockGeometry";

const EDGES: readonly SideDockEdge[] = ["left", "right"];

export function useSideDocksSync(islandSide: SideDockEdge | null, quiet: boolean) {
  const { settings } = useSideDocks();
  const enabledSides = useMemo(() => sideDockEnabledSides(settings, islandSide), [islandSide, settings]);
  const { left: leftEnabled, right: rightEnabled } = enabledSides;
  const enabledRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    const currentEnabled = { left: leftEnabled, right: rightEnabled };
    for (const edge of EDGES) {
      const active = currentEnabled[edge];
      const wasActive = enabledRef.current[edge];
      if (active === wasActive) continue;
      enabledRef.current[edge] = active;
      const current = settingsRef.current;
      const sideConfig = current[edge];
      const size = sideDockWindowSize(current, sideConfig.pinned ? "drawer" : "handle");
      void syncSideDock(edge, active, size.width, size.height, sideConfig.along).catch((error) => {
        console.error(`Failed to sync ${edge} side dock`, error);
      });
    }
  }, [leftEnabled, rightEnabled]);

  useEffect(() => {
    const visible = !settings.hideInFullscreen || !quiet;
    for (const edge of EDGES) {
      if (!enabledSides[edge]) continue;
      void setSideDockVisible(edge, visible).catch(() => undefined);
    }
  }, [enabledSides, quiet, settings.hideInFullscreen]);
}
