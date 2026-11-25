import { History } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import type { SettingsFocusSection } from "../settings/storage";
import { ActHeading } from "./ActHeading";
import { IslandFormsPicker } from "./IslandFormsPicker";
import { SideDockSplitCard } from "./SideDockSplitCard";
import { useReleaseGuideData } from "./useReleaseGuideData";
import "./WhatsNewAct.css";

export function WhatsNewNotesAct({
  fromVersion,
  onLeaveForSettings,
}: {
  fromVersion: string | null;
  onLeaveForSettings: (section?: SettingsFocusSection) => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().onboarding.whatsNew;
  const release = useReleaseGuideData(locale);

  return (
    <>
      <div className="whats-new-act__banner">
        <div className="whats-new-act__version-group">
          {release.version && <span className="whats-new-act__pill">v{release.version.replace(/^v/i, "")}</span>}
          {fromVersion && release.version && (
            <span className="whats-new-act__span">{text.upgradedFrom(fromVersion, release.version)}</span>
          )}
        </div>
        {release.date && <span className="whats-new-act__date">{text.releasedAt(release.date)}</span>}
      </div>

      <ActHeading title={text.title(release.version)} lead={text.lead} />

      <div className="whats-new-act__notes">
        {release.loading ? (
          <p className="whats-new-act__empty">{text.loading}</p>
        ) : release.lines.length === 0 ? (
          <p className="whats-new-act__empty">{text.empty}</p>
        ) : (
          <div className="whats-new-act__list">
            {release.lines.slice(0, 18).map((line, idx) =>
              line.kind === "heading" ? (
                <h2 key={`${idx}:${line.text}`} className="whats-new-act__heading">
                  {line.text}
                </h2>
              ) : line.kind === "item" ? (
                <p key={`${idx}:${line.text}`} className="whats-new-act__item">
                  • {line.text}
                </p>
              ) : (
                <p key={`${idx}:${line.text}`} className="whats-new-act__text">
                  {line.text}
                </p>
              ),
            )}
          </div>
        )}
      </div>

      <div className="whats-new-act__footer">
        <button className="onboarding-release__link" type="button" onClick={() => onLeaveForSettings("updates")}>
          <History size={14} aria-hidden="true" />
          {text.openHistory}
        </button>
      </div>
    </>
  );
}

export function WhatsNewFormsAct({
  settings,
  onSettingsChange,
  onUserInteract,
  onLeaveForSettings,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onUserInteract?: () => void;
  onLeaveForSettings?: (section?: SettingsFocusSection) => void;
}) {
  const text = useTranslation().onboarding.whatsNew;
  return (
    <>
      <ActHeading title={text.formsTitle} lead={text.formsLead} />
      <IslandFormsPicker settings={settings} onSettingsChange={onSettingsChange} onUserInteract={onUserInteract} />
      <SideDockSplitCard
        onUserInteract={onUserInteract}
        onOpenSettings={onLeaveForSettings ? () => onLeaveForSettings("sideDocks") : undefined}
      />
    </>
  );
}
