import type { Context } from "@fuyu/plugin-base";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  EMPTY_STATE,
  METHODS,
  TOPICS,
  bucketValid,
  objectKey,
  parseEndpoint,
  publicBaseValid,
  type CopyFormat,
  type HostConfig,
  type HostState,
  type KeyName,
  type Missing,
} from "./model.ts";
import { failureText, text } from "./text.ts";
import "./styles.css";

type Patch = (patch: Partial<HostConfig>) => Promise<HostConfig>;

const MISSING_TEXT: Record<Missing, string> = {
  endpoint: text.missingEndpoint,
  bucket: text.missingBucket,
  keys: text.missingKeys,
};

const pad = (value: number) => String(value).padStart(2, "0");
const clockOf = (at: number) => {
  const date = new Date(at);
  return `${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-image-host__group">
      <h3 className="fuyu-image-host__title">{title}</h3>
      {hint && <p className="fuyu-image-host__note">{hint}</p>}
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  hint,
  warn,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  warn?: string | null;
  onCommit: (value: string) => Promise<string>;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <label className="fuyu-image-host__field">
      <span className="fuyu-image-host__label">{label}</span>
      <input
        className="fuyu-image-host__input"
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft.trim() !== value) void onCommit(draft.trim()).then(setDraft, () => {});
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {warn ? <span className="fuyu-image-host__note is-warn">{warn}</span> : hint && <span className="fuyu-image-host__note">{hint}</span>}
    </label>
  );
}

function KeyInput({ name, saved, onSave }: { name: KeyName; saved: boolean; onSave: (name: KeyName, value: string) => Promise<unknown> }) {
  const [value, setValue] = useState("");
  return (
    <label className="fuyu-image-host__field">
      <span className="fuyu-image-host__label">
        {name === "accessKeyId" ? text.accessKeyId : text.secretAccessKey}
        <span className={saved ? "fuyu-image-host__badge is-on" : "fuyu-image-host__badge"}>{saved ? text.saved : text.notSaved}</span>
      </span>
      <input
        className="fuyu-image-host__input"
        type="password"
        value={value}
        placeholder={saved ? text.keyPlaceholderSaved : text.keyPlaceholder}
        spellCheck={false}
        autoComplete="new-password"
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          const typed = value.trim();
          if (typed) void onSave(name, typed).then(() => setValue(""), () => {});
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </label>
  );
}

function Status({ state }: { state: HostState }) {
  const lastText = state.last ? (state.last.test ? text.lastTest : text.lastUpload)(clockOf(state.last.at)) : null;
  return (
    <div className="fuyu-image-host__card">
      <p className="fuyu-image-host__summary">
        {state.missing.length === 0 ? text.ready : `${text.missing}${state.missing.map((item) => MISSING_TEXT[item]).join(" · ")}`}
      </p>
      {state.last && (
        <div className="fuyu-image-host__last">
          <span className="fuyu-image-host__note">{lastText}</span>
          <code className="fuyu-image-host__link">{state.last.url}</code>
        </div>
      )}
      {state.error && <p className="fuyu-image-host__note is-warn">{failureText(state.error, text)}</p>}
    </div>
  );
}

export default function apply(ctx: Context) {
  function ImageHostSection() {
    const [state, setState] = useState<HostState>(EMPTY_STATE);

    const take = useCallback((next: HostState) => setState((prev) => (next.at >= prev.at ? next : prev)), []);
    const call = useCallback(
      (method: string, params?: unknown) =>
        ctx.host.call<HostState>(method, params).then((next) => {
          take(next);
          return next;
        }),
      [take],
    );

    useEffect(() => {
      const off = ctx.host.on(TOPICS.state, take);
      ctx.host.call<HostState>(METHODS.state).then(take, () => {});
      return () => {
        void off();
      };
    }, [take]);

    const { config, keys } = state;
    const patch: Patch = (next) => call(METHODS.setConfig, next).then((saved) => saved.config);
    const endpointWarn = config.endpoint && !parseEndpoint(config.endpoint) ? text.endpointBad : null;
    const bucketWarn = config.bucket && !bucketValid(config.bucket) ? text.bucketBad : null;
    const publicWarn = publicBaseValid(config.publicBase) ? null : text.publicBaseBad;
    const saveKey = (name: KeyName, value: string) => call(METHODS.saveKeys, { [name]: value });

    return (
      <section className="fuyu-image-host">
        <Status state={state} />

        <Group title={text.storageTitle} hint={text.storageHint}>
          <Field key={`endpoint:${config.endpoint}`} label={text.endpoint} value={config.endpoint} placeholder="https://…" hint={text.endpointHint} warn={endpointWarn} onCommit={(endpoint) => patch({ endpoint }).then((saved) => saved.endpoint)} />
          <div className="fuyu-image-host__pair">
            <Field key={`bucket:${config.bucket}`} label={text.bucket} value={config.bucket} warn={bucketWarn} onCommit={(bucket) => patch({ bucket }).then((saved) => saved.bucket)} />
            <Field key={`region:${config.region}`} label={text.region} value={config.region} placeholder="auto" hint={text.regionHint} onCommit={(region) => patch({ region }).then((saved) => saved.region)} />
          </div>
          <label className="fuyu-image-host__check">
            <input type="checkbox" checked={config.pathStyle} onChange={(event) => void patch({ pathStyle: event.target.checked }).catch(() => {})} />
            <span>{text.pathStyle}</span>
          </label>
          <p className="fuyu-image-host__note">{text.pathStyleHint}</p>
        </Group>

        <Group title={text.keysTitle} hint={text.keysHint}>
          {(["accessKeyId", "secretAccessKey"] as const).map((name) => (
            <KeyInput key={name} name={name} saved={keys[name]} onSave={saveKey} />
          ))}
          <div className="fuyu-image-host__actions">
            <button type="button" className="fuyu-image-host__button is-quiet" disabled={!keys.accessKeyId && !keys.secretAccessKey} onClick={() => void call(METHODS.clearKeys).catch(() => {})}>
              {text.clearKeys}
            </button>
          </div>
        </Group>

        <Group title={text.linkTitle}>
          <Field key={`prefix:${config.prefix}`} label={text.prefix} value={config.prefix} hint={text.prefixHint(objectKey(config.prefix, new Date(), "a1b2c3"))} onCommit={(prefix) => patch({ prefix }).then((saved) => saved.prefix)} />
          <Field key={`public:${config.publicBase}`} label={text.publicBase} value={config.publicBase} placeholder="https://…" hint={text.publicBaseHint} warn={publicWarn} onCommit={(publicBase) => patch({ publicBase }).then((saved) => saved.publicBase)} />
          <div className="fuyu-image-host__row">
            <span className="fuyu-image-host__label">{text.copyAs}</span>
            <div className="fuyu-image-host__seg" role="radiogroup" aria-label={text.copyAs}>
              {([["url", text.copyUrl], ["markdown", text.copyMarkdown]] as const).map(([format, caption]: readonly [CopyFormat, string]) => (
                <button key={format} type="button" role="radio" aria-checked={config.copyAs === format} className={config.copyAs === format ? "fuyu-image-host__seg-item is-on" : "fuyu-image-host__seg-item"} onClick={() => void patch({ copyAs: format }).catch(() => {})}>
                  {caption}
                </button>
              ))}
            </div>
          </div>
        </Group>

        <Group title={text.testTitle} hint={text.testHint}>
          <div className="fuyu-image-host__actions">
            <button type="button" className="fuyu-image-host__button" disabled={state.busy || state.missing.length > 0} onClick={() => void call(METHODS.test).catch(() => {})}>
              {state.busy ? text.testing : text.test}
            </button>
          </div>
        </Group>
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "image-host", category: "pluginsV3", component: ImageHostSection });
}
