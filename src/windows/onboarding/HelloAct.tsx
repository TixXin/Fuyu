import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { LOCALE_CODES, TRANSLATIONS, useLocale, useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";

export function HelloAct() {
  const t = useTranslation();
  const text = t.onboarding.hello;
  const { locale, setLocale } = useLocale();

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <SettingsGroup>
        <SettingsRow
          title={text.language}
          control={
            <SettingsChoice
              value={locale}
              ariaLabel={text.language}
              options={LOCALE_CODES.map((code) => ({ value: code, label: TRANSLATIONS[code].localeLabel }))}
              onChange={setLocale}
            />
          }
        />
      </SettingsGroup>
    </>
  );
}
