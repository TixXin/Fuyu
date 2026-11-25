import { useMemo, useState } from "react";
import {
  Bot,
  Columns3,
  History,
  LayoutGrid,
  Palette,
  Play,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { JellyfishMark } from "../../components/jellyfish/JellyfishMark";
import { useLocale, useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";
import type { SettingsFocusSection } from "../settings/storage";
import { ActHeading } from "./ActHeading";
import type { DirectorSceneId } from "./directorScenes";
import { IslandFormsPicker } from "./IslandFormsPicker";
import { parseReleaseShowcase, type ReleaseSectionTheme } from "./releaseShowcase";
import { SideDockSplitCard } from "./SideDockSplitCard";
import { useReleaseGuideData } from "./useReleaseGuideData";
import "./WhatsNewAct.css";

const THEME_ICONS: Record<ReleaseSectionTheme, LucideIcon> = {
  jellyfish: Sparkles,
  agent: Bot,
  wing: Columns3,
  panel: LayoutGrid,
  appearance: Palette,
  fix: Wrench,
  general: Sparkles,
};

export function WhatsNewNotesAct({
  fromVersion,
  onLeaveForSettings,
  onDemoScene,
}: {
  fromVersion: string | null;
  onLeaveForSettings: (section?: SettingsFocusSection) => void;
  onDemoScene?: (scene: DirectorSceneId) => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().onboarding.whatsNew;
  const release = useReleaseGuideData(locale);
  const [selectedSection, setSelectedSection] = useState<string>("all");

  const sections = useMemo(
    () => parseReleaseShowcase(release.lines, text.autoGroups),
    [release.lines, text.autoGroups],
  );
  const totalItems = useMemo(
    () => sections.reduce((sum, section) => sum + section.items.length, 0),
    [sections],
  );
  const activeTab = sections.some((section) => section.id === selectedSection) ? selectedSection : "all";
  const visibleSections = activeTab === "all" ? sections : sections.filter((section) => section.id === activeTab);

  return (
    <>
      <div className="whats-new__hero">
        <div className="whats-new__emblem" aria-hidden="true">
          <JellyfishMark mood="idle" height={44} lively />
        </div>
        <div className="whats-new__hero-body">
          <div className="whats-new__meta">
            {release.version && <span className="whats-new__pill">v{release.version.replace(/^v/i, "")}</span>}
            {fromVersion && release.version && (
              <span className="whats-new__chip">{text.upgradedFrom(fromVersion, release.version)}</span>
            )}
            {release.date && <span className="whats-new__chip">{text.releasedAt(release.date)}</span>}
            {totalItems > 0 && (
              <span className="whats-new__chip">{text.stats(sections.length, totalItems)}</span>
            )}
          </div>
          <h1 className="whats-new__title">{text.title(release.version)}</h1>
          <p className="whats-new__lead">{text.lead}</p>
        </div>
      </div>

      {release.loading ? (
        <div className="whats-new__empty-box">
          <p className="whats-new__empty">{text.loading}</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="whats-new__empty-box">
          <p className="whats-new__empty">{text.empty}</p>
        </div>
      ) : (
        <>
          {sections.length > 1 && (
            <div className="whats-new__tabs" role="tablist" aria-label={text.tabsLabel}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={activeTab === "all" ? "whats-new__tab whats-new__tab--active" : "whats-new__tab"}
                onClick={() => setSelectedSection("all")}
              >
                {text.allHighlights}
                <span className="whats-new__tab-count">{totalItems}</span>
              </button>
              {sections.map((section) => {
                const Icon = THEME_ICONS[section.theme];
                const active = activeTab === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={active ? "whats-new__tab whats-new__tab--active" : "whats-new__tab"}
                    onClick={() => setSelectedSection(section.id)}
                  >
                    <Icon size={12} aria-hidden="true" />
                    <span>{section.heading}</span>
                    <span className="whats-new__tab-count">{section.items.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="whats-new__sections">
            {visibleSections.map((section) => {
              const Icon = THEME_ICONS[section.theme];
              const featuredFirst = section.items.length >= 3 && section.items.length % 2 === 1;
              return (
                <section key={section.id} className={`whats-new__section whats-new__section--${section.theme}`}>
                  <div className="whats-new__sec-head">
                    <span className="whats-new__sec-title">
                      <span className="whats-new__sec-icon" aria-hidden="true">
                        <Icon size={13} />
                      </span>
                      <span>{section.heading}</span>
                      <span className="whats-new__sec-count">{section.items.length}</span>
                    </span>
                    {section.demoScene && onDemoScene && (
                      <button
                        type="button"
                        className="whats-new__demo-btn"
                        data-whats-new-demo={section.demoScene}
                        onClick={() => onDemoScene(section.demoScene!)}
                      >
                        <Play size={10} aria-hidden="true" />
                        {text.tryLive}
                      </button>
                    )}
                  </div>
                  <div className="whats-new__grid">
                    {section.items.map((item, idx) => (
                      <article
                        key={`${section.id}:${idx}`}
                        className={featuredFirst && idx === 0 ? "whats-new__card whats-new__card--featured" : "whats-new__card"}
                      >
                        <span className="whats-new__card-bar" aria-hidden="true" />
                        {item.title && <h3 className="whats-new__card-title">{item.title}</h3>}
                        <p className="whats-new__card-detail">{item.detail}</p>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <div className="whats-new__footer">
        <button className="onboarding-release__link" type="button" onClick={() => onLeaveForSettings("updates")}>
          <History size={14} aria-hidden="true" />
          {text.openHistory}
        </button>
        <span className="whats-new__next-hint">{text.nextFormsHint}</span>
      </div>
    </>
  );
}

export function WhatsNewFormsAct({
  settings,
  onSettingsChange,
  onUserInteract,
  onLeaveForSettings,
  onWingsPreview,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onUserInteract?: () => void;
  onLeaveForSettings?: (section?: SettingsFocusSection) => void;
  onWingsPreview?: (open: boolean) => void;
}) {
  const text = useTranslation().onboarding.whatsNew;
  return (
    <>
      <ActHeading title={text.formsTitle} lead={text.formsLead} />
      <IslandFormsPicker settings={settings} onSettingsChange={onSettingsChange} onUserInteract={onUserInteract} />
      <SideDockSplitCard
        onUserInteract={onUserInteract}
        onOpenSettings={onLeaveForSettings ? () => onLeaveForSettings("sideDocks") : undefined}
        onWingsPreview={onWingsPreview}
      />
    </>
  );
}
