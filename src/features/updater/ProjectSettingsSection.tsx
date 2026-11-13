import { CircleHelp, Globe, Star, Tag } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { useLocale, useTranslation } from "../../i18n";
import { ProjectLink } from "./ProjectLink";
import { PROJECT_REPO_URL, websitePage } from "./projectLinks";
import "./ProjectSettingsSection.css";
import "./UpdatePanel.css";

export function ProjectLinksSection() {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.project;

  return (
    <SettingsGroup title={text.linksTitle}>
      <div className="about-links">
        <ProjectLink
          href={websitePage(locale)}
          tone="website"
          title={text.website}
          hint={text.websiteHint}
          icon={<Globe className="project-link__icon" size={18} strokeWidth={1.8} aria-hidden="true" />}
        />
        <ProjectLink
          href={websitePage(locale, "releases/")}
          tone="release"
          title={text.releases}
          hint={text.releasesHint}
          icon={<Tag className="project-link__icon" size={18} strokeWidth={1.8} aria-hidden="true" />}
        />
        <ProjectLink
          href={websitePage(locale, "community/")}
          tone="community"
          title={text.issues}
          hint={text.issuesHint}
          icon={<CircleHelp className="project-link__icon" size={18} strokeWidth={1.8} aria-hidden="true" />}
        />
        <ProjectLink
          href={PROJECT_REPO_URL}
          tone="star"
          title={text.star}
          hint={text.starHint}
          icon={<Star className="project-link__icon" size={19} strokeWidth={1.8} aria-hidden="true" />}
        />
      </div>
    </SettingsGroup>
  );
}
