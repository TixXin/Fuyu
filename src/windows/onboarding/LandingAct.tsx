import { useEffect, useState } from "react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import type { IslandSettings } from "../../features/appearance/types";
import { LOCALE_CODES, TRANSLATIONS, useLocale, useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import { MiniDesk } from "./MiniDesk";
import { MiniIsland } from "./MiniIsland";
import type { OnboardingModule } from "./personas";
import "./LandingAct.css";

const HELLO_MS = 1_400;

/** Act 1: a drop of light falls from the top and becomes the island, which says hello in turn; clicking it begins. */
export function LandingAct({ settings, modules, onBegin }: { settings: IslandSettings; modules: ReadonlySet<OnboardingModule>; onBegin: () => void }) {
  const t = useTranslation();
  const text = t.onboarding.landing;
  const { locale, setLocale } = useLocale();
  const [hello, setHello] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setHello((at) => at + 1), HELLO_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <MiniDesk
        tall
        island={
          <div className="landing-act__drop">
            <MiniIsland
              settings={settings}
              modules={modules}
              label={text.hellos[hello % text.hellos.length]}
              live
              highlight
              ariaLabel={text.tapIsland}
              onClick={onBegin}
            />
          </div>
        }
      >
        <p className="landing-act__hint" aria-hidden="true">{text.tapIsland}</p>
      </MiniDesk>
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
