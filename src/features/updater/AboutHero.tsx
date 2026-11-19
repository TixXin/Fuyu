import { useSyncExternalStore } from "react";
import { CircleHelp, Globe, Star, Tag } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { useDevBuild } from "../../lib/platform";
import { PROJECT_REPO_URL, websitePage } from "./projectLinks";
import { UpdatePanel } from "./UpdatePanel";
import { useOpenInBrowser } from "./useOpenInBrowser";
import { getUpdateState, subscribeToUpdate } from "./updaterController";
import "./AboutHero.css";

function AboutLinks() {
  const t = useTranslation();
  const text = t.settings.project;
  const { locale } = useLocale();
  const { failed, onClick } = useOpenInBrowser();
  const links = [
    { href: websitePage(locale), label: text.website, hint: text.websiteHint, tone: "website", Icon: Globe },
    { href: websitePage(locale, "releases/"), label: text.releases, hint: text.releasesHint, tone: "release", Icon: Tag },
    { href: websitePage(locale, "community/"), label: text.issues, hint: text.issuesHint, tone: "community", Icon: CircleHelp },
    { href: PROJECT_REPO_URL, label: text.star, hint: text.starHint, tone: "star", Icon: Star },
  ] as const;

  return (
    <>
      <nav className="about-hero__links" aria-label={text.linksTitle}>
        {links.map(({ href, label, hint, tone, Icon }) => (
          <a key={tone} className={`about-hero__link about-hero__link--${tone}`} href={href} title={hint} target="_blank" rel="noopener noreferrer" onClick={onClick}>
            <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      {failed && <p className="project-link-error" role="alert">{text.openFailed}</p>}
    </>
  );
}

export function AboutHero() {
  const text = useTranslation().settings.project;
  const devBuild = useDevBuild();
  const { stage, version, channel } = useSyncExternalStore(subscribeToUpdate, getUpdateState);
  const tone = devBuild ? "dev" : stage === "disabled" ? "stable" : channel;

  return (
    <section className={`about-hero about-hero--${tone}`} aria-label={text.appName}>
      <span className="about-hero__emblem" aria-hidden="true" />
      <div className="about-hero__heading">
        <p className="about-hero__name">{text.appName}</p>
        {version ? <span className="about-hero__tag about-hero__tag--version">{text.versionChip(version)}</span> : null}
        {devBuild ? (
          <span className="about-hero__tag about-hero__tag--beta">{text.hero.devTag}</span>
        ) : stage === "disabled" ? null : (
          <span className={`about-hero__tag${channel === "beta" ? " about-hero__tag--beta" : ""}`}>
            {channel === "beta" ? text.hero.beta : text.hero.stable}
          </span>
        )}
      </div>
      <p className="about-hero__description">{text.description}</p>
      <UpdatePanel />
      <AboutLinks />
    </section>
  );
}
