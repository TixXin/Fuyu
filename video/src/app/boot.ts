import { AGENT_APPROVAL_STORAGE_KEY, DEFAULT_AGENT_APPROVAL_SETTINGS } from "../../../src/features/agent-status/approvals/storage";
import { ISLAND_SETTINGS_KEY } from "../../../src/features/appearance/installState";
import { DEFAULT_SETTINGS } from "../../../src/features/appearance/settingsDefaults";
import { LOCALE_STORAGE_KEY } from "../../../src/i18n";
import { installBackend } from "./backend";
import { createWorld, type World } from "./world";

export type IslandFrame = Window & {
  __world: World;
  __emit: (event: string, payload: unknown) => Promise<void>;
  __seed?: (world: World) => void;
};

const params = new URLSearchParams(location.search);
const world = createWorld();
const host = window as unknown as IslandFrame;
(window.parent as unknown as IslandFrame).__seed?.(world);

const changed = { ...(params.get("format") === "vertical" ? { panelWidth: 560 } : {}), ...world.settings };
localStorage.clear();
localStorage.setItem(LOCALE_STORAGE_KEY, params.get("lang") === "en" ? "en" : "zh-CN");
if (Object.keys(changed).length > 0) {
  localStorage.setItem(ISLAND_SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...changed }));
  localStorage.setItem(AGENT_APPROVAL_STORAGE_KEY, JSON.stringify(DEFAULT_AGENT_APPROVAL_SETTINGS));
}

const backend = installBackend(world);
host.__world = world;
host.__emit = backend.emit;

await import("../../../src/main.tsx");
