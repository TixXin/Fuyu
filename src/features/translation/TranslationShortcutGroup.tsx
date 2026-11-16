import type { Dispatch, ReactNode, SetStateAction } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useTranslation } from "../../i18n";
import { FeatureOffRow } from "../../components/settings/ShortcutFeatureOffRow";
import type { ShortcutTakenBy as TakenBy } from "../../lib/shortcut/conflicts";
import type { TranslationSettings } from "./storage";
import { TranslationShortcutRows } from "./TranslationShortcutRows";

export function TranslationShortcutGroup({ title, action, enabled, translation, onTranslationChange, takenBy, onTurnOn }: {
  title: string;
  action: ReactNode;
  enabled: boolean;
  translation: TranslationSettings;
  onTranslationChange: Dispatch<SetStateAction<TranslationSettings>>;
  takenBy: TakenBy;
  onTurnOn?: () => void;
}) {
  const t = useTranslation();
  if (!enabled && !onTurnOn) return null;
  return (
    <SettingsGroup
      title={title}
      action={action}
      footer={!enabled ? undefined : onTurnOn ? t.settings.translation.selectionShortcutHint : `${t.settings.shortcuts.globalHint} ${t.settings.translation.selectionShortcutHint}`}
    >
      {enabled
        ? <TranslationShortcutRows settings={translation} onSettingsChange={onTranslationChange} takenBy={takenBy} />
        : onTurnOn && <FeatureOffRow feature={t.settings.categories.translation} onTurnOn={onTurnOn} />}
    </SettingsGroup>
  );
}
