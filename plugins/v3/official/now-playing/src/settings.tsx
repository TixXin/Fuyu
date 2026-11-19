import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { currentLocale } from "./locale.ts";
import { DEFAULT_CONFIG, DURATIONS, METHODS, TOPICS, appLabel, type NoticeConfig, type NoticeState } from "./model.ts";
import { TEXT } from "./text.ts";
import "./styles.css";

type Patch = (patch: Partial<NoticeConfig>) => void;
type FlagKey = "autoNotify" | "lastOnly" | "showControls" | "skipFrontmost" | "browsers";

const INITIAL: NoticeState = { config: DEFAULT_CONFIG, current: null, note: null, updatedAt: 0 };

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-track-notice__group">
      <h3 className="fuyu-track-notice__title">{title}</h3>
      {hint && <p className="fuyu-track-notice__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Choice<T extends string | number>({ label, value, options, onPick, disabled }: { label: string; value: T; options: [T, string][]; onPick: (value: T) => void; disabled?: boolean }) {
  return (
    <div className="fuyu-track-notice__row">
      <span className="fuyu-track-notice__label">{label}</span>
      <div className="fuyu-track-notice__seg" role="radiogroup" aria-label={label}>
        {options.map(([option, caption]) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            className={value === option ? "fuyu-track-notice__seg-item is-on" : "fuyu-track-notice__seg-item"}
            onClick={() => onPick(option)}
          >
            {caption}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, config, patch, disabled }: { name: FlagKey; label: string; config: NoticeConfig; patch: Patch; disabled?: boolean }) {
  return (
    <label className="fuyu-track-notice__check">
      <input type="checkbox" checked={config[name]} disabled={disabled} onChange={(event) => patch({ [name]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

export default function apply(ctx: Context) {
  function TrackNoticeSection() {
    const copy = TEXT[currentLocale()];
    const [state, setState] = useState<NoticeState>(INITIAL);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const take = useCallback((next: NoticeState) => {
      setState((prev) => (next.updatedAt >= prev.updatedAt ? next : prev));
    }, []);

    useEffect(() => {
      const off = ctx.host.on(TOPICS.state, take);
      ctx.host.call<NoticeState>(METHODS.getState).then(take, (reason: unknown) => setError(errorText(reason)));
      return () => {
        void off();
      };
    }, [take]);

    const patch: Patch = useCallback((next) => {
      setError(null);
      setState((prev) => ({ ...prev, config: { ...prev.config, ...next } }));
      ctx.host.call<NoticeState>(METHODS.setConfig, next).then(take, (reason: unknown) => setError(errorText(reason)));
    }, [take]);

    const showNow = useCallback(() => {
      setBusy(true);
      setError(null);
      ctx.host
        .call<NoticeState>(METHODS.showNow)
        .then(take, (reason: unknown) => setError(errorText(reason)))
        .finally(() => setBusy(false));
    }, [take]);

    const { config } = state;
    const off = !config.autoNotify;
    const title = state.current?.playing ? state.current.title?.trim() ?? "" : "";
    const artist = state.current?.artist?.trim() || copy.unknownArtist;
    const toggleApp = (app: string, on: boolean) => {
      const apps = on ? [...config.apps.filter((item) => item !== app), app] : config.apps.filter((item) => item !== app);
      patch({ apps });
    };

    return (
      <section className="fuyu-track-notice">
        <Group title={copy.noticeTitle} hint={copy.noticeHint}>
          <Flag name="autoNotify" label={copy.autoNotify} config={config} patch={patch} />
          <Flag name="lastOnly" label={copy.lastOnly} config={config} patch={patch} disabled={off} />
          <Flag name="skipFrontmost" label={copy.skipFrontmost} config={config} patch={patch} disabled={off} />
          <div className="fuyu-track-notice__actions">
            <button type="button" className="fuyu-track-notice__button" disabled={busy} onClick={showNow}>
              {copy.showNow}
            </button>
            <span className="fuyu-track-notice__note">{state.note ?? (title ? `${copy.playing}${title} · ${artist}` : copy.nothingPlaying)}</span>
          </div>
        </Group>
        <Group title={copy.displayTitle}>
          <Choice
            label={copy.content}
            value={config.content}
            options={[["title-artist", copy.contentTitleArtist], ["title", copy.contentTitle], ["title-artist-album", copy.contentAlbum]]}
            onPick={(content) => patch({ content })}
          />
          <Choice
            label={copy.duration}
            value={config.durationSec}
            options={DURATIONS.map((n) => [n, copy.seconds(n)] as [number, string])}
            onPick={(durationSec) => patch({ durationSec })}
          />
          <Flag name="showControls" label={copy.showControls} config={config} patch={patch} />
        </Group>
        <Group title={copy.appsTitle}>
          <Choice
            label={copy.appsMode}
            value={config.appMode}
            options={[["all", copy.appsAll], ["some", copy.appsSome]]}
            onPick={(appMode) => patch({ appMode })}
            disabled={off}
          />
          {config.appMode === "all" && <Flag name="browsers" label={copy.browsers} config={config} patch={patch} disabled={off} />}
          {config.appMode === "some" && (
            <div className="fuyu-track-notice__apps">
              {config.seenApps.length === 0 && <p className="fuyu-track-notice__hint">{copy.appsEmpty}</p>}
              {config.seenApps.map((app) => (
                <label key={app} className="fuyu-track-notice__check" title={app}>
                  <input type="checkbox" checked={config.apps.includes(app)} disabled={off} onChange={(event) => toggleApp(app, event.target.checked)} />
                  <span>{appLabel(app, currentLocale())}</span>
                </label>
              ))}
              {config.seenApps.length > 0 && config.apps.length === 0 && <p className="fuyu-track-notice__hint">{copy.appsNoneTicked}</p>}
            </div>
          )}
        </Group>
        {error && <p className="fuyu-track-notice__hint">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/now-playing",
    category: "pluginsV3",
    component: TrackNoticeSection,
  });
}
