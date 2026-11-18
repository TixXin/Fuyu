import { LOCALE_CODES, LOCALE_LABELS, isLocaleCode, useTranslation, type LocaleCode } from "../../../i18n";
import { isMacOS, useDevBuild } from "../../../lib/platform";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSelect } from "../../../components/settings/SettingsSelect";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { TrayCardLayoutRow } from "./TrayCardLayoutRow";

const LOCALE_OPTIONS = LOCALE_CODES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }));

export function BehaviorSettingsSection({
  launchAtStartup,
  trayIconVisible,
  locale,
  onLaunchAtStartupChange,
  onTrayIconVisibleChange,
  onLocaleChange,
}: {
  launchAtStartup: boolean;
  trayIconVisible: boolean;
  locale: LocaleCode;
  onLaunchAtStartupChange: (enabled: boolean) => void;
  onTrayIconVisibleChange: (visible: boolean) => void;
  onLocaleChange: (locale: LocaleCode) => void;
}) {
  const t = useTranslation();
  const devBuild = useDevBuild();
  return (
    <SettingsGroup title={t.settings.behavior.title}>
      <SettingsToggleRow
        title={isMacOS ? t.settings.layout.launchAtStartupMac : t.settings.layout.launchAtStartup}
        description={devBuild ? t.settings.devBuild.launchAtStartupOff : undefined}
        checked={launchAtStartup}
        disabled={devBuild}
        onChange={onLaunchAtStartupChange}
      />
      <SettingsToggleRow
        title={isMacOS ? t.settings.layout.trayIconMac : t.settings.layout.trayIcon}
        description={trayIconVisible ? undefined : isMacOS ? t.settings.layout.trayIconHiddenHintMac : t.settings.layout.trayIconHiddenHint}
        checked={trayIconVisible}
        onChange={onTrayIconVisibleChange}
      />
      <TrayCardLayoutRow trayIconVisible={trayIconVisible} />
      <SettingsRow
        title={t.settings.language.label}
        control={
          <SettingsSelect
            value={locale}
            options={LOCALE_OPTIONS}
            ariaLabel={t.settings.language.label}
            onChange={(next) => {
              if (isLocaleCode(next)) onLocaleChange(next);
            }}
          />
        }
      />
    </SettingsGroup>
  );
}
