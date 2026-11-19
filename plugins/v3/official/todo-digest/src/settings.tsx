import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { buildDigest } from "./digest.ts";
import { EMPTY_STATE, METHODS, TOPICS, clockOf, isValidTime, type DigestSettings, type DigestState } from "./model.ts";
import { text } from "./text.ts";
import "./styles.css";

type Patch = (patch: Partial<DigestSettings>) => void;
type FlagKey = "replace" | "writeWhenDone" | "autoWrite" | "notify";

const PREVIEW_LINES = 8;
const errorText = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-todo-digest__group">
      <h3 className="fuyu-todo-digest__title">{title}</h3>
      {children}
      {hint && <p className="fuyu-todo-digest__note">{hint}</p>}
    </div>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="fuyu-todo-digest__row">
      <span className="fuyu-todo-digest__label">{label}</span>
      <div className="fuyu-todo-digest__seg" role="radiogroup" aria-label={label}>
        {options.map(([option, caption]) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            className={value === option ? "fuyu-todo-digest__seg-item is-on" : "fuyu-todo-digest__seg-item"}
            onClick={() => onChange(option)}
          >
            {caption}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: DigestSettings; patch: Patch }) {
  return (
    <label className="fuyu-todo-digest__check">
      <input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function Preview({ state, now }: { state: DigestState; now: number }) {
  const block = buildDigest(state.todos, state.settings, text, clockOf(now));
  if (block === null) return <p className="fuyu-todo-digest__note">{text.skipped}</p>;
  const lines = block.split("\n");
  const shown = lines.slice(0, PREVIEW_LINES);
  return (
    <div className="fuyu-todo-digest__preview" aria-label={text.previewTitle}>
      <pre className="fuyu-todo-digest__block">{shown.join("\n")}</pre>
      {lines.length > shown.length && <p className="fuyu-todo-digest__note">{text.previewMore(lines.length - shown.length)}</p>}
    </div>
  );
}

export default function apply(ctx: Context) {
  function DigestSection() {
    const [state, setState] = useState<DigestState>(EMPTY_STATE);
    const [writing, setWriting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const now = useNow();

    const take = useCallback((next: DigestState) => setState((prev) => (next.at >= prev.at ? next : prev)), []);

    useEffect(() => {
      const off = ctx.host.on(TOPICS.state, take);
      ctx.host.call<DigestState>(METHODS.state).then(take, (reason: unknown) => setError(errorText(reason)));
      return () => {
        void off();
      };
    }, [take]);

    const call = useCallback(
      (method: string, params?: unknown) =>
        ctx.host
          .call<DigestState>(method, params)
          .then(take)
          .catch((reason: unknown) => setError(errorText(reason))),
      [take],
    );

    const onWrite = () => {
      setWriting(true);
      setError(null);
      void call(METHODS.writeDigest).finally(() => setWriting(false));
    };

    const { settings } = state;
    const patch: Patch = (next) => {
      setError(null);
      void call(METHODS.setSettings, next);
    };

    return (
      <section className="fuyu-todo-digest">
        <div className="fuyu-todo-digest__card">
          <div className="fuyu-todo-digest__header">
            <p className="fuyu-todo-digest__summary">{state.error ?? text.summary(state.openCount, state.total)}</p>
            <button type="button" className="fuyu-todo-digest__button" disabled={writing || state.error !== null} onClick={onWrite}>
              {writing ? text.writing : text.write}
            </button>
          </div>
          {state.error === null && <Preview state={state} now={now} />}
          {state.lastOutcome === "skipped" ? (
            <p className="fuyu-todo-digest__note">{text.skipped}</p>
          ) : (
            state.lastWrittenAt !== null && <p className="fuyu-todo-digest__note">{text.writtenAt(clockOf(state.lastWrittenAt))}</p>
          )}
          {error && <p className="fuyu-todo-digest__note is-warn">{error}</p>}
        </div>

        <Group title={text.contentTitle} hint={settings.replace ? text.replaceHint : undefined}>
          <Segmented
            label={text.scope}
            value={settings.scope}
            options={[["open", text.scopeOpen], ["openCount", text.scopeOpenCount], ["all", text.scopeAll]]}
            onChange={(scope) => patch({ scope })}
          />
          <Segmented
            label={text.format}
            value={settings.format}
            options={[["list", text.formatList], ["checkbox", text.formatCheckbox]]}
            onChange={(format) => patch({ format })}
          />
          <Flag name="writeWhenDone" label={text.writeWhenDone} settings={settings} patch={patch} />
          <Flag name="replace" label={text.replace} settings={settings} patch={patch} />
        </Group>

        <Group title={text.autoTitle} hint={settings.autoWrite ? text.autoHint : undefined}>
          <div className="fuyu-todo-digest__line">
            <Flag name="autoWrite" label={text.autoWrite} settings={settings} patch={patch} />
            <input
              type="time"
              className="fuyu-todo-digest__time"
              aria-label={text.autoWrite}
              value={settings.autoTime}
              disabled={!settings.autoWrite}
              onChange={(event) => {
                if (isValidTime(event.target.value)) patch({ autoTime: event.target.value });
              }}
            />
          </div>
        </Group>

        <Group title={text.noticeTitle}>
          <Flag name="notify" label={text.notify} settings={settings} patch={patch} />
        </Group>
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "todo-digest", category: "pluginsV3", component: DigestSection });
}
