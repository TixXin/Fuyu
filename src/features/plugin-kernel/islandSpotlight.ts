export const ISLAND_PLUGIN_SPOTLIGHT_EVENT = "island-plugin-spotlight";
export const SPOTLIGHT_ANIMATION = "plugin-spotlight";
export const SPOTLIGHT_WAIT_MS = 15_000;
export const SPOTLIGHT_HOLD_MS = 3_000;

const ISLAND_SLOTS: readonly string[] = ["island.collapsed/v1", "island.page/v1"];

export type IslandSpotlightRequest = { pluginId: string };

export function readIslandSpotlightRequest(payload: unknown): IslandSpotlightRequest | null {
  if (!payload || typeof payload !== "object") return null;
  const { pluginId } = payload as { pluginId?: unknown };
  return typeof pluginId === "string" && pluginId !== "" ? { pluginId } : null;
}

export function showsOnIsland(slots: readonly string[] | null | undefined): boolean {
  return (slots ?? []).some((slot) => ISLAND_SLOTS.includes(slot));
}

type Timer = ReturnType<typeof setTimeout>;

export type SpotlightClock = {
  setTimer: (run: () => void, ms: number) => Timer;
  clearTimer: (timer: Timer) => void;
};

export function createSpotlightStore(clock: SpotlightClock = { setTimer: (run, ms) => setTimeout(run, ms), clearTimer: (timer) => clearTimeout(timer) }) {
  let owner: string | null = null;
  let timer: Timer | null = null;
  const listeners = new Set<() => void>();

  const expireIn = (ms: number) => {
    if (timer !== null) clock.clearTimer(timer);
    timer = clock.setTimer(() => {
      timer = null;
      set(null);
    }, ms);
  };
  const set = (next: string | null) => {
    if (next === null && timer !== null) {
      clock.clearTimer(timer);
      timer = null;
    }
    if (owner === next) return;
    owner = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    owner: () => owner,
    request(pluginId: string) {
      set(pluginId);
      expireIn(SPOTLIGHT_WAIT_MS);
    },
    hold(pluginId: string) {
      if (owner === pluginId) expireIn(SPOTLIGHT_HOLD_MS);
    },
    end(pluginId: string) {
      if (owner === pluginId) set(null);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const islandSpotlight = createSpotlightStore();
