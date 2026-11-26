import type { Context } from "@fuyu/plugin-base";
import type { ReactNode } from "react";
import { LIMIT_OPTIONS, type FileSearchSettings, type MacScope } from "./model.ts";
import { text } from "./text.ts";
import { useFileSearchState } from "./useFileSearch.ts";
import "./settings.css";

type Patch = (patch: Partial<FileSearchSettings>) => void;
type FlagKey = "showRecent" | "rememberQuery" | "autoCollapse";

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-fs-set__group">
      <h3 className="fuyu-fs-set__title">{title}</h3>
      {hint && <p className="fuyu-fs-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Segmented<T extends string | number>({
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
    <div className="fuyu-fs-set__row">
      <span className="fuyu-fs-set__label">{label}</span>
      <div className="fuyu-fs-set__seg" role="radiogroup" aria-label={label}>
        {options.map(([option, name]) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={option === value ? "fuyu-fs-set__seg-item is-on" : "fuyu-fs-set__seg-item"}
            onClick={() => onChange(option)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: FileSearchSettings; patch: Patch }) {
  return (
    <label className="fuyu-fs-set__check">
      <input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

const SCOPES: readonly (readonly [MacScope, string])[] = [
  ["home", text.scopeHome],
  ["common", text.scopeCommon],
  ["all", text.scopeAll],
];

export default function apply(ctx: Context) {
  function FileSearchSection() {
    const { state, error, setSettings } = useFileSearchState(ctx);
    const { settings, backend } = state;
    const engineHint =
      backend === "everything" ? text.settingsEngineHintWin : backend === "spotlight" ? text.settingsEngineHintMac : undefined;
    return (
      <section className="fuyu-fs-set">
        <Group title={text.settingsSearch} hint={engineHint}>
          {backend === "spotlight" && (
            <Segmented
              label={text.settingsScope}
              value={settings.macScope}
              options={SCOPES}
              onChange={(macScope) => setSettings({ macScope })}
            />
          )}
          <Segmented
            label={text.settingsLimit}
            value={settings.resultLimit}
            options={LIMIT_OPTIONS.map((n) => [n, String(n)] as const)}
            onChange={(resultLimit) => setSettings({ resultLimit })}
          />
        </Group>
        <Group title={text.settingsBehavior}>
          <Flag name="showRecent" label={text.settingsShowRecent} settings={settings} patch={setSettings} />
          <Flag name="rememberQuery" label={text.settingsRememberQuery} settings={settings} patch={setSettings} />
          <Flag name="autoCollapse" label={text.settingsAutoCollapse} settings={settings} patch={setSettings} />
        </Group>
        {error && <p className="fuyu-fs-set__hint is-warn">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "@fuyu/file-search", category: "pluginsV3", component: FileSearchSection });
}
