import { useSyncExternalStore } from "react";
import { CircleHelp, Globe, Sparkles, Star, Tag } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useLocale, useTranslation } from "../../i18n";
import { UpdateDiagnosticsRow } from "./UpdateDiagnosticsRow";
import { ProjectLink } from "./ProjectLink";
import { useOpenInBrowser } from "./useOpenInBrowser";
import { PROJECT_REPO_URL, websitePage } from "./projectLinks";
import { getUpdateState, subscribeToUpdate } from "./updaterController";
import "./ProjectSettingsSection.css";
import "./UpdatePanel.css";

/**
 * Settings → About, first: the island's name, version and what it does. Fuyu has no
 * logo yet: its spot is an empty slot that, like the credit line under the
 * description, leads to the logo call on the website. The chosen design and its
 * designer's name go here.
 */
export function ProjectIdentitySection() {
  const t = useTranslation();
  const { version } = useSyncExternalStore(subscribeToUpdate, getUpdateState);
  const { failed, onClick } = useOpenInBrowser();
  const text = t.settings.project;

  return (
    <SettingsGroup>
      <div className="about-identity">
        <a
          className="about-identity__slot"
          href={text.logoCallUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          aria-label={text.logoCall}
          title={text.logoCall}
        >
          <span aria-hidden="true">?</span>
        </a>
        <div className="about-identity__body">
          <div className="about-identity__heading">
            <p className="about-identity__name">{text.appName}</p>
            {version && <span className="about-identity__version">{text.versionChip(version)}</span>}
          </div>
          <p className="about-identity__description">{text.description}</p>
          <a className="about-identity__credit" href={text.logoCallUrl} target="_blank" rel="noopener noreferrer" onClick={onClick}>
            <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" />
            <span>{text.logoCredit}</span>
            <strong>{text.logoOpen}</strong>
          </a>
          {failed && (
            <p className="project-link-error" role="alert">{text.openFailed}</p>
          )}
        </div>
      </div>
    </SettingsGroup>
  );
}

/** Settings → About → Links: the website, releases, reporting a problem, and starring the project. */
export function ProjectLinksSection() {
  const t = useTranslation();
  const { locale } = useLocale();

  return (
    <SettingsGroup title={t.settings.project.linksTitle}>
      <ProjectLink
        href={websitePage(locale)}
        title={t.settings.project.website}
        hint={t.settings.project.websiteHint}
        icon={<Globe className="project-link__icon" size={18} strokeWidth={1.8} aria-hidden="true" />}
      />
      <ProjectLink
        href={websitePage(locale, "releases/")}
        tone="release"
        title={t.settings.project.releases}
        hint={t.settings.project.releasesHint}
        icon={<Tag className="project-link__icon" size={18} strokeWidth={1.8} aria-hidden="true" />}
      />
      <ProjectLink
        href={websitePage(locale, "community/")}
        title={t.settings.project.issues}
        hint={t.settings.project.issuesHint}
        icon={<CircleHelp className="project-link__icon" size={18} strokeWidth={1.8} aria-hidden="true" />}
      />
      <UpdateDiagnosticsRow />
      <ProjectLink
        href={PROJECT_REPO_URL}
        tone="star"
        title={t.settings.project.star}
        hint={t.settings.project.starHint}
        icon={<Star className="project-link__icon" size={19} strokeWidth={1.8} aria-hidden="true" />}
      />
    </SettingsGroup>
  );
}
