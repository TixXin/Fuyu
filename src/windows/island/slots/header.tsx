import { Minus, RotateCcw, Settings } from "lucide-react";
import { shortcutLabel } from "../../../lib/shortcut/shortcut";
import type { MessageSource } from "../../../features/messages/messagePreview";
import { defineSlot, type IslandHeaderMeta } from "../../../features/plugin-kernel/slots";
import { useUpdateReminder } from "../../../features/updater/useBackgroundUpdateCheck";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { pageShortcutLabel, type IslandFeatures } from "../features";
import type { IslandPage } from "../types";

export type IslandHeaderContext = {
  page: IslandPage;
  features: IslandFeatures;
  isDetached: boolean;
  qqNotificationCount: number;
  wechatPending: boolean;
  onOpenSettings: (section?: "updates") => void;
  onOpenMessages: (source: MessageSource) => void;
  onOpenTranslator: (() => void) | null;
  onScreenshot: (() => void) | null;
  onResetPosition: () => void;
  minimizesToTray: boolean;
  onMinimize: () => void;
  pageDigitModifiers: string;
  withShortcut: (label: string, target: IslandPage) => string;
  isPageEnabled: (target: IslandPage) => boolean;
};

export const headerSlot = defineSlot<IslandHeaderContext, IslandHeaderMeta<IslandHeaderContext>>("island.header/v1");

export function withShortcut({ features, pageDigitModifiers }: Pick<IslandHeaderContext, "features" | "pageDigitModifiers">, label: string, target: IslandPage) {
  const shortcut = pageShortcutLabel(features, target, pageDigitModifiers);
  return shortcut ? `${label} (${shortcutLabel(shortcut)})` : label;
}

function SettingsButton({ onOpenSettings }: IslandHeaderContext) {
  const t = useTranslation();
  const updateVersion = useUpdateReminder();
  const settingsLabel = updateVersion ? t.settings.project.update.islandReminder(updateVersion) : t.settings.title;
  return (
    <button
      className="icon-button island-settings-button"
      type="button"
      aria-label={settingsLabel}
      onClick={(event) => {
        event.stopPropagation();
        onOpenSettings(updateVersion ? "updates" : undefined);
      }}
    >
      <Settings size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      {updateVersion && <span className="island-settings-button__dot" aria-hidden="true" />}
    </button>
  );
}

function ResetPositionButton({ isDetached, onResetPosition }: IslandHeaderContext) {
  const t = useTranslation();
  return (
    <button
      className={`icon-button island-reset-button${
        isDetached ? " island-reset-button--available" : ""
      }`}
      type="button"
      aria-label={t.island.resetPositionLabel}
      onClick={(event) => {
        event.stopPropagation();
        onResetPosition();
      }}
    >
      <RotateCcw size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
    </button>
  );
}

function MinimizeButton({ minimizesToTray, onMinimize }: IslandHeaderContext) {
  const t = useTranslation();
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={minimizesToTray ? (isMacOS ? t.island.minimizeToMenuBar : t.island.minimizeToTray) : t.island.tuckToTop}
      onClick={(event) => {
        event.stopPropagation();
        onMinimize();
      }}
    >
      <Minus size={16} strokeWidth={1.5} absoluteStrokeWidth />
    </button>
  );
}

headerSlot.add({ id: "settings", order: 10, component: SettingsButton });
headerSlot.add({ id: "reset-position", order: 50, component: ResetPositionButton });
headerSlot.add({ id: "minimize", order: 60, component: MinimizeButton });
