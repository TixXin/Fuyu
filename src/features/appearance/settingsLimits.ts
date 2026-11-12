import type { AgentArchiveMotion, AgentCardEffects, AgentHostDisplay, AgentSessionGroup, AgentSessionSort, AgentSessionView } from "./types";

export const AGENT_HOST_DISPLAYS: readonly AgentHostDisplay[] = ["both", "icon", "name", "off"];
export const AGENT_SESSION_VIEWS: readonly AgentSessionView[] = ["list", "cards", "compact"];
export const AGENT_SESSION_SORTS: readonly AgentSessionSort[] = ["status", "recent", "firstSeen"];
export const AGENT_SESSION_GROUPS: readonly AgentSessionGroup[] = ["computer", "project", "none"];
export const AGENT_ARCHIVE_MOTIONS: readonly AgentArchiveMotion[] = ["slide", "dissolve"];
export const AGENT_CARD_EFFECTS: readonly AgentCardEffects[] = ["off", "sparkle", "gradient"];
export const AGENT_SESSION_HOURS = [1, 2, 6, 24] as const;
export const AGENT_ALERT_SECONDS = [3, 5, 8, 15, 30] as const;
export const MESSAGE_PANEL_SECONDS = AGENT_ALERT_SECONDS;
export const MESSAGE_NOTICES = ["line", "banner", "panel"] as const;
export const AGENT_REMIND_SECONDS = [0, 30, 60, 120, 300] as const;
export const AGENT_QUOTA_ALERT_PERCENTS = [0, 70, 80, 90] as const;

export const MAX_CUSTOM_SETTING_PRESETS = 6;
export const MIN_TOP_FILLET_RADIUS = 0;
export const MAX_TOP_FILLET_RADIUS = 12;
export const DEFAULT_ISLAND_CORNER_RADIUS = 32;
export const MIN_ISLAND_CORNER_RADIUS = 16;
export const MAX_ISLAND_CORNER_RADIUS = 40;
export const DEFAULT_HOVER_EXPAND_DELAY_MS = 0;
export const MIN_HOVER_EXPAND_DELAY_MS = 0;
export const MAX_HOVER_EXPAND_DELAY_MS = 1_000;
export const DEFAULT_HOVER_COLLAPSE_DELAY_MS = 0;
export const MIN_HOVER_COLLAPSE_DELAY_MS = 0;
export const MAX_HOVER_COLLAPSE_DELAY_MS = 2_000;
export const DEFAULT_HOVER_SWITCH_DELAY_MS = 0;
export const MIN_HOVER_SWITCH_DELAY_MS = 0;
export const MAX_HOVER_SWITCH_DELAY_MS = 1_000;
export const DEFAULT_AUTO_TUCK_RETRACT_DELAY_MS = 500;
export const MIN_AUTO_TUCK_RETRACT_DELAY_MS = 0;
export const MAX_AUTO_TUCK_RETRACT_DELAY_MS = 3_000;
export const DEFAULT_MAX_PANEL_HEIGHT = 360;
export const MIN_MAX_PANEL_HEIGHT = 360;
export const MAX_MAX_PANEL_HEIGHT = 640;
export const DEFAULT_PANEL_WIDTH = 800;
export const MIN_PANEL_WIDTH = 480;
export const MAX_PANEL_WIDTH = 800;
export const MIN_COLLAPSED_WIDTH_EXTRA = -60;
export const MAX_COLLAPSED_WIDTH_EXTRA = 180;
export const DEFAULT_SHELF_ITEMS = 100;
export const MIN_SHELF_ITEMS = 20;
export const MAX_SHELF_ITEMS = 200;
export const SHELF_CLEANUP_DAYS = [0, 1, 7, 30] as const;
export const DEFAULT_TASK_TEXT_COLOR = "#ffffff";

export function oneOf<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return (allowed as readonly unknown[]).includes(value) ? (value as T) : fallback;
}
