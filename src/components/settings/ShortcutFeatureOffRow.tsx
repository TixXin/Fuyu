import { SettingsLinkButton } from "./SettingsLinkButton";
import { SettingsRow } from "./SettingsRow";
import { useTranslation } from "../../i18n";
import "./ShortcutFeatureOffRow.css";

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
