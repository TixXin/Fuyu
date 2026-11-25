import { Sparkles, SlidersHorizontal, Hand } from "lucide-react";
import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { LOCALE_CODES, LOCALE_LABELS, useLocale, useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import "./HelloAct.css";

const PREVIEW_ICONS = [Sparkles, SlidersHorizontal, Hand] as const;

export function HelloAct() {
  const t = useTranslation();
  const text = t.onboarding.hello;
  const { locale, setLocale } = useLocale();

  return (
    <>
      <div className="hello-act__hero">
        <div className="hello-act__emblem" aria-hidden="true">
          <JellyfishMark mood="idle" height={34} lively />
        </div>
        <ActHeading title={text.title} lead={text.lead} />
      </div>
      <div className="hello-act__roadmap" aria-label={text.previewLabel}>
        {text.previewItems.map((label, at) => {
          const Icon = PREVIEW_ICONS[at];
          return (
            <span key={label} className="hello-act__pill">
              <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </span>
          );
        })}
      </div>
      <SettingsGroup>
        <SettingsRow
          title={text.language}
          control={
            <SettingsChoice
              value={locale}
              ariaLabel={text.language}
              options={LOCALE_CODES.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}
              onChange={setLocale}
            />
          }
        />
      </SettingsGroup>
    </>
  );
}
