import { Settings } from "lucide-react";
import { shortcutLabel } from "../../../lib/shortcut/shortcut";
import { defineSlot, type IslandHeaderMeta } from "../../../features/plugin-kernel/slots";
import { runIslandAction, useIslandContributed } from "../../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../../i18n";
import { pageShortcutLabel, type IslandFeatures } from "../features";
import { OPEN_SETTINGS_SHORTCUT } from "../useIslandKeyboard";
import type { IslandPage } from "../types";

export type IslandHeaderContext = {
  page: IslandPage;
  features: IslandFeatures;
  isDetached: boolean;
  onOpenSettings: (section?: "updates") => void;
  onOpenTranslator: (() => void) | null;
  hints: ReadonlySet<string>;
  onResetPosition: () => void;
  minimizesToTray: boolean;
  onMinimize: () => void;
  pageDigitModifiers: string;
  withShortcut: (label: string, target: IslandPage) => string;
  isPageEnabled: (target: IslandPage) => boolean;
  isPageShown: (target: IslandPage) => boolean;
};

export const PANEL_LAYOUT_ID = "panel-layout";
export const TRAILING_HEADER_IDS: ReadonlySet<string> = new Set([PANEL_LAYOUT_ID, "settings"]);

export const headerSlot = defineSlot<IslandHeaderContext, IslandHeaderMeta<IslandHeaderContext>>("island.header/v1");

export function withShortcut({ features, pageDigitModifiers }: Pick<IslandHeaderContext, "features" | "pageDigitModifiers">, label: string, target: IslandPage) {
  const shortcut = pageShortcutLabel(features, target, pageDigitModifiers);
  return shortcut ? `${label} (${shortcutLabel(shortcut)})` : label;
}

function SettingsButton({ onOpenSettings }: IslandHeaderContext) {
  const t = useTranslation();
  const badge = useIslandContributed().badges.get("settings");
  return (
    <button
      className="icon-button island-settings-button"
      type="button"
      aria-label={badge?.label ?? `${t.settings.title} (${OPEN_SETTINGS_SHORTCUT})`}
      onClick={(event) => {
        event.stopPropagation();
        if (!badge?.action || !runIslandAction(badge.action)) onOpenSettings();
      }}
    >
      <Settings size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      {badge && <span className="island-settings-button__dot" aria-hidden="true" />}
    </button>
  );
}

headerSlot.add({ id: "settings", order: 1000, component: SettingsButton });
