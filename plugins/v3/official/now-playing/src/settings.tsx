import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState } from "react";
import { METHODS, TEXT, TOPICS, detectLocale, type NowPlayingState } from "./types.ts";
import "./styles.css";

const INITIAL: NowPlayingState = {
  config: { autoNotify: false, locale: detectLocale() },
  current: null,
  note: null,
  updatedAt: 0,
};

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export default function apply(ctx: Context) {
  function Section() {
    const locale = detectLocale();
    const copy = TEXT[locale];
    const [state, setState] = useState<NowPlayingState>(INITIAL);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const take = (next: NowPlayingState) => {
        setState((prev) => (next.updatedAt >= prev.updatedAt ? next : prev));
      };
      const off = ctx.host.on(TOPICS.state, take);
      ctx.host.call<NowPlayingState>(METHODS.getState, { locale }).then(take, (reason: unknown) => {
        setError(errorText(reason));
      });
      return () => {
        void off();
      };
    }, []);

    const toggleAutoNotify = useCallback((checked: boolean) => {
      setError(null);
      ctx.host
        .call<NowPlayingState>(METHODS.setConfig, { autoNotify: checked, locale })
        .then(setState, (reason: unknown) => setError(errorText(reason)));
    }, [locale]);

    const showNow = useCallback(() => {
      setBusy(true);
      setError(null);
      ctx.host
        .call<NowPlayingState>(METHODS.showNow, { locale })
        .then(setState, (reason: unknown) => setError(errorText(reason)))
        .finally(() => setBusy(false));
    }, [locale]);

    const title = state.current?.title?.trim() ?? "";
    const artist = state.current?.artist?.trim() || copy.unknownArtist;

    return (
      <section className="fuyu-now-playing">
        <div className="fuyu-now-playing__header">
          <h3 className="fuyu-now-playing__title">{copy.title}</h3>
          <p className="fuyu-now-playing__subtitle">{copy.subtitle}</p>
        </div>

        <div className="fuyu-now-playing__card">
          <span className="fuyu-now-playing__track">
            {title ? `${copy.playingPrefix}${title} · ${artist}` : copy.nothingPlaying}
          </span>
        </div>

        <label className="fuyu-now-playing__toggle">
          <div className="fuyu-now-playing__toggle-text">
            <span className="fuyu-now-playing__label">{copy.autoNotify}</span>
            <span className="fuyu-now-playing__desc">{copy.autoNotifyDesc}</span>
          </div>
          <input
            type="checkbox"
            checked={state.config.autoNotify}
            onChange={(event) => toggleAutoNotify(event.target.checked)}
          />
        </label>

        <div className="fuyu-now-playing__actions">
          <button
            type="button"
            className="fuyu-now-playing__button"
            disabled={busy}
            onClick={showNow}
          >
            {copy.showNow}
          </button>
          {state.note && <span className="fuyu-now-playing__note">{state.note}</span>}
        </div>

        {error && <p className="fuyu-now-playing__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/now-playing",
    category: "pluginsV3",
    component: Section,
  });
}
