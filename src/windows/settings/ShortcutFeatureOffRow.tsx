import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import "./ShortcutsSettingsPage.css";

export type TakenBy = (shortcut: string, selfId: string) => string | null;

export function FeatureOffRow({ feature, onTurnOn }: { feature: string; onTurnOn: () => void }) {
  const t = useTranslation();
  return (
    <SettingsRow
      searchable={false}
      title={<span className="shortcut-empty">{t.settings.shortcuts.featureOff(feature)}</span>}
      control={<SettingsLinkButton onClick={onTurnOn}>{t.settings.shortcuts.turnOn}</SettingsLinkButton>}
    />
  );
}
