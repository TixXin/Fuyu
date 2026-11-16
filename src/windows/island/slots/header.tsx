import { Bell, Languages, Minus, RotateCcw, Scissors, Settings } from "lucide-react";
import { shortcutLabel } from "../../../lib/shortcut/shortcut";
import type { MessageSource } from "../../../features/messages/messagePreview";
import { defineSlot, type IslandHeaderMeta } from "../../../features/plugin-kernel/slots";
import { useUpdateReminder } from "../../../features/updater/useBackgroundUpdateCheck";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { isPageEnabled, pageShortcutLabel, type IslandFeatures } from "../features";
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

function MessagesButton(context: IslandHeaderContext) {
  const { page, qqNotificationCount, wechatPending, onOpenMessages } = context;
  const t = useTranslation();
  const messageBadgeLabel = t.messages.badge(qqNotificationCount, wechatPending);
  return <button className={`icon-button island-message-button${page === "qq" ? " island-message-button--active" : ""}`} type="button" aria-label={withShortcut(context, t.messages.label(messageBadgeLabel), "qq")} aria-pressed={page === "qq"} onClick={() => onOpenMessages(wechatPending ? "wechat" : "qq")}>
    <Bell size={16} strokeWidth={1.5} absoluteStrokeWidth />
    {(qqNotificationCount > 0 || wechatPending) && <span className="island-message-button__dot" aria-hidden="true" />}
  </button>;
}

function TranslateButton(context: IslandHeaderContext) {
  const { page, features, onOpenTranslator } = context;
  const t = useTranslation();
  return (
    <button
      className={`icon-button island-translate-button${page === "translation" ? " island-translate-button--active" : ""}`}
      type="button"
      aria-label={features.translation ? withShortcut(context, t.translator.title, "translation") : t.translator.title}
      aria-pressed={features.translation ? page === "translation" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onOpenTranslator?.();
      }}
    >
      <Languages size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
    </button>
  );
}

function ScreenshotButton({ onScreenshot }: IslandHeaderContext) {
  const t = useTranslation();
  return (
    <button
      className="icon-button island-screenshot-button"
      type="button"
      aria-label={t.island.screenshot}
      onClick={(event) => {
        event.stopPropagation();
        onScreenshot?.();
      }}
    >
      <Scissors size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
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
headerSlot.add({ id: "messages", order: 20, enabled: ({ features }) => isPageEnabled("qq", features), component: MessagesButton });
headerSlot.add({ id: "translator", order: 30, enabled: ({ onOpenTranslator }) => Boolean(onOpenTranslator), component: TranslateButton });
headerSlot.add({ id: "screenshot", order: 40, enabled: ({ onScreenshot }) => Boolean(onScreenshot), component: ScreenshotButton });
headerSlot.add({ id: "reset-position", order: 50, component: ResetPositionButton });
headerSlot.add({ id: "minimize", order: 60, component: MinimizeButton });
