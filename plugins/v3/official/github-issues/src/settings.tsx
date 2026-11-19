import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState, type ReactNode } from "react";
import { METHODS, MINUTE_OPTIONS, PER_REPO_OPTIONS, normalizeLabels, type IssuesSettings, type SortKey } from "./model.ts";
import { RepoList } from "./settingsRepos.tsx";
import { text } from "./text.ts";
import { useIssues } from "./useIssues.ts";
import "./settings.css";

type Patch = (patch: Partial<IssuesSettings>) => void;
type FlagKey = "includePulls" | "showAuthor" | "showUpdated" | "showComments" | "refreshOnOpen" | "showInBar" | "notifyNew";

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-gh-set__group">
      <h3 className="fuyu-gh-set__title">{title}</h3>
      {hint && <p className="fuyu-gh-set__hint">{hint}</p>}
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
    <div className="fuyu-gh-set__row">
      <span className="fuyu-gh-set__label">{label}</span>
      <div className="fuyu-gh-set__seg" role="radiogroup" aria-label={label}>
        {options.map(([option, name]) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={option === value}
            className={option === value ? "fuyu-gh-set__seg-item is-on" : "fuyu-gh-set__seg-item"}
            onClick={() => onChange(option)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: IssuesSettings; patch: Patch }) {
  return (
    <label className="fuyu-gh-set__check">
      <input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

function LabelsField({ value, patch }: { value: string; patch: Patch }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (normalizeLabels(draft) !== value) patch({ labels: draft });
  };
  return (
    <label className="fuyu-gh-set__field">
      <span className="fuyu-gh-set__label">{text.labels}</span>
      <input
        className="fuyu-gh-set__input"
        value={draft}
        placeholder={text.labelsPlaceholder}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
      <span className="fuyu-gh-set__hint">{text.labelsHint}</span>
    </label>
  );
}

function MinutesField({ value, patch }: { value: number; patch: Patch }) {
  const options: number[] = MINUTE_OPTIONS.includes(value as (typeof MINUTE_OPTIONS)[number])
    ? [...MINUTE_OPTIONS]
    : [...MINUTE_OPTIONS, value].sort((a, b) => a - b);
  return (
    <label className="fuyu-gh-set__row">
      <span className="fuyu-gh-set__label">{text.refreshMinutes}</span>
      <select className="fuyu-gh-set__select" value={value} onChange={(event) => patch({ refreshMinutes: Number(event.target.value) })}>
        {options.map((n) => (
          <option key={n} value={n}>
            {text.minutes(n)}
          </option>
        ))}
      </select>
    </label>
  );
}

const SORTS: readonly (readonly [SortKey, string])[] = [
  ["updated", text.sortUpdated],
  ["created", text.sortCreated],
  ["comments", text.sortComments],
];

export default function apply(ctx: Context) {
  function IssuesSection() {
    const { state, error, invoke, addRepo } = useIssues(ctx);
    const { settings } = state;
    const patch: Patch = (next) => invoke(METHODS.setSettings, next);
    return (
      <section className="fuyu-gh-set">
        <Group title={text.reposTitle} hint={text.reposHint}>
          <RepoList repos={settings.repos} invoke={invoke} addRepo={addRepo} />
        </Group>
        <Group title={text.listTitle}>
          <Segmented
            label={text.perRepo}
            value={settings.perRepo}
            options={PER_REPO_OPTIONS.map((n) => [n, String(n)] as const)}
            onChange={(perRepo) => patch({ perRepo })}
          />
          <Segmented label={text.sort} value={settings.sort} options={SORTS} onChange={(sort) => patch({ sort })} />
          <LabelsField value={settings.labels} patch={patch} />
          <Flag name="includePulls" label={text.includePulls} settings={settings} patch={patch} />
        </Group>
        <Group title={text.rowTitle}>
          <Flag name="showUpdated" label={text.showUpdated} settings={settings} patch={patch} />
          <Flag name="showComments" label={text.showComments} settings={settings} patch={patch} />
          <Flag name="showAuthor" label={text.showAuthor} settings={settings} patch={patch} />
        </Group>
        <Group title={text.refreshTitle}>
          <MinutesField value={settings.refreshMinutes} patch={patch} />
          <Flag name="refreshOnOpen" label={text.refreshOnOpen} settings={settings} patch={patch} />
          <Flag name="notifyNew" label={text.notifyNew} settings={settings} patch={patch} />
        </Group>
        <Group title={text.barSection}>
          <Flag name="showInBar" label={text.showInBar} settings={settings} patch={patch} />
        </Group>
        {error && <p className="fuyu-gh-set__hint is-warn">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "@fuyu/github-issues", category: "pluginsV3", component: IssuesSection });
}
