import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useOpenInBrowser } from "./useOpenInBrowser";
import { getUpdateState, subscribeToUpdate, type UpdateState } from "./updaterController";
import "./AboutHero.css";

type Tone = "ok" | "new" | "busy" | "error" | "muted";

const GREETING_MS = 2_600;

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
  const [greeting, setGreeting] = useState<number | null>(null);
  const taps = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const greet = () => {
    window.clearTimeout(timer.current);
    setGreeting(taps.current % text.hero.greetings.length);
    taps.current += 1;
    timer.current = window.setTimeout(() => setGreeting(null), GREETING_MS);
  };
  const line = greeting !== null ? text.hero.greetings[greeting] : status?.[0] ?? "";

  return (
    <section className={greeting !== null ? "about-hero about-hero--greeting" : "about-hero"} aria-label={text.appName}>
      <div className="about-hero__scene" aria-hidden="true">
        <i /><i /><i /><i /><i /><i />
        <span className="about-hero__sea"><b /><b /><b /></span>
      </div>
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
        <button
          className={`about-hero__island about-hero__island--${greeting !== null ? "ok" : status?.[1] ?? "ok"}`}
          type="button"
          aria-label={text.hero.greet}
          title={text.hero.greet}
          onClick={greet}
        >
          <i />
          {line ? <span className="about-hero__island-text" role="status" key={line}>{line}</span> : null}
          <b />
          <b />
          <b />
        </button>
      </div>
    </section>
  );
}
