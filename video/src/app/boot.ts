import { AGENT_APPROVAL_STORAGE_KEY, DEFAULT_AGENT_APPROVAL_SETTINGS } from "../../../src/features/agent-status/approvals/storage";
import { FIRST_HINTS_STORAGE_KEY } from "../../../src/windows/island/first-hints/storage";
import { FIRST_HINT_IDS } from "../../../src/windows/island/first-hints/hints";
import { ISLAND_SETTINGS_KEY } from "../../../src/lib/settings/installState";
import { DEFAULT_SETTINGS } from "../../../src/lib/settings/settingsDefaults";
import { LOCALE_STORAGE_KEY } from "../../../src/i18n";
import { deliverNotice } from "../../../src/features/messages/plugin/notices";
import type { IslandNotice } from "../../../src/lib/island-notices/service";
import { installBackend } from "./backend";
import { createWorld, type World } from "./world";

export type IslandFrame = Window & {
  __world: World;
  __emit: (event: string, payload: unknown) => Promise<void>;
  __seed?: (world: World) => void;
  __notice: (notice: IslandNotice) => boolean;
};

const params = new URLSearchParams(location.search);
const world = createWorld();
const host = window as unknown as IslandFrame;
(window.parent as unknown as IslandFrame).__seed?.(world);

const changed = { ...(params.get("format") === "vertical" ? { panelWidth: 560 } : {}), ...world.settings };
if (params.get("window") !== "settings") {
  localStorage.clear();
  localStorage.setItem(FIRST_HINTS_STORAGE_KEY, JSON.stringify({ dismissed: FIRST_HINT_IDS, shown: {}, lastShownAt: 0 }));
  localStorage.setItem(LOCALE_STORAGE_KEY, params.get("lang") === "en" ? "en" : "zh-CN");
  if (Object.keys(changed).length > 0) {
    localStorage.setItem(ISLAND_SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...changed }));
    localStorage.setItem(AGENT_APPROVAL_STORAGE_KEY, JSON.stringify(DEFAULT_AGENT_APPROVAL_SETTINGS));
  }
}

const backend = installBackend(world);
host.__world = world;
host.__emit = backend.emit;
host.__notice = deliverNotice;

await import("../../../src/main.tsx");
