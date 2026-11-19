import { useEffect, useSyncExternalStore, type AnimationEvent } from "react";
import { listenIslandPluginSpotlight } from "../../features/plugin-kernel/api";
import { islandSpotlight, SPOTLIGHT_ANIMATION } from "../../features/plugin-kernel/islandSpotlight";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { collapsedBarSlot } from "./slots/collapsed";
import "./PluginSpotlight.css";

type SpotlightEvent = AnimationEvent<HTMLElement>;

export type SpotlightProps = {
  "data-spotlight": "";
  onAnimationStart: (event: SpotlightEvent) => void;
  onAnimationEnd: (event: SpotlightEvent) => void;
};

const own = (event: SpotlightEvent) => event.animationName === SPOTLIGHT_ANIMATION && event.target === event.currentTarget;

function spotlightProps(owner: string): SpotlightProps {
  return {
    "data-spotlight": "",
    onAnimationStart: (event) => {
      if (own(event)) islandSpotlight.hold(owner);
    },
    onAnimationEnd: (event) => {
      if (own(event)) islandSpotlight.end(owner);
    },
  };
}

function useSpotlightOwner(): string | null {
  return useSyncExternalStore(islandSpotlight.subscribe, islandSpotlight.owner, islandSpotlight.owner);
}

export function useCollapsedSpotlight(ids: readonly string[]): SpotlightProps | undefined {
  const owner = useSpotlightOwner();
  const entries = useSlotEntries(collapsedBarSlot);
  if (owner === null) return undefined;
  return entries.some((entry) => entry.external && entry.owner === owner && ids.includes(entry.id)) ? spotlightProps(owner) : undefined;
}

export function useHeaderSpotlight(): (item: { owner: string; external: boolean }) => SpotlightProps | undefined {
  const owner = useSpotlightOwner();
  return (item) => (owner !== null && item.external && item.owner === owner ? spotlightProps(owner) : undefined);
}

export function usePluginSpotlightRequests() {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void listenIslandPluginSpotlight(({ pluginId }) => islandSpotlight.request(pluginId))
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for plugin spotlight requests", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
