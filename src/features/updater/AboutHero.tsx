import { useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useOpenInBrowser } from "./useOpenInBrowser";
import { getUpdateState, subscribeToUpdate, type UpdateState } from "./updaterController";
import "./AboutHero.css";

type Tone = "ok" | "new" | "busy" | "error" | "muted";

function heroStatus(state: UpdateState, text: ReturnType<typeof useTranslation>["settings"]["project"]["hero"]): [string, Tone] | null {
  switch (state.stage) {
    case "disabled": return null;
    case "idle": return [text.idle, "muted"];
    case "checking": return [text.checking, "busy"];
    case "latest": return [text.latest, "ok"];
    case "available": return [text.available(state.nextVersion), "new"];
    case "downloading": return [text.downloading, "busy"];
    case "ready": return [text.ready(state.nextVersion), "new"];
    case "installing": return [text.installing, "busy"];
    case "done": return [text.done, "ok"];
    case "error": return [text.error, "error"];
  }
}

export function AboutHero() {
  const t = useTranslation();
  const text = t.settings.project;
  const state = useSyncExternalStore(subscribeToUpdate, getUpdateState);
  const { failed, onClick } = useOpenInBrowser();
  const status = heroStatus(state, text.hero);

  return (
    <section className="about-hero" aria-label={text.appName}>
      <a
        className="about-identity__slot about-hero__logo"
        href={text.logoCallUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-label={text.logoCall}
        title={text.logoCall}
      >
        <span aria-hidden="true">?</span>
      </a>
      <div className="about-hero__body">
        <div className="about-hero__heading">
          <p className="about-hero__name">{text.appName}</p>
          {state.version ? <span className="about-hero__tag">{text.versionChip(state.version)}</span> : null}
          {state.stage === "disabled" ? null : (
            <span className={`about-hero__tag${state.channel === "beta" ? " about-hero__tag--beta" : ""}`}>
              {state.channel === "beta" ? text.hero.beta : text.hero.stable}
            </span>
          )}
        </div>
        <p className="about-hero__description">{text.description}</p>
        <a className="about-identity__credit" href={text.logoCallUrl} target="_blank" rel="noopener noreferrer" onClick={onClick}>
          <Sparkles size={12} strokeWidth={1.8} aria-hidden="true" />
          <span>{text.logoCredit}</span>
          <strong>{text.logoOpen}</strong>
        </a>
        {failed ? <p className="project-link-error" role="alert">{text.openFailed}</p> : null}
      </div>
      <div className="about-hero__side">
        <span className="about-hero__island" aria-hidden="true">
          <i />
          <b />
          <b />
          <b />
        </span>
        {status ? (
          <span className={`about-hero__status about-hero__status--${status[1]}`} role="status">
            {status[0]}
          </span>
        ) : null}
      </div>
    </section>
  );
}
