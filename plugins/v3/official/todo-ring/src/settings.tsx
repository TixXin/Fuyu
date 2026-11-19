import type { Context } from "@fuyu/plugin-base";
import type { ReactNode } from "react";
import { METHODS, SHOW_COUNTS, type RingSettings } from "./model.ts";
import { text } from "./text.ts";
import { useRing } from "./useRing.ts";
import "./settings.css";

type Patch = (patch: Partial<RingSettings>) => void;
type FlagKey = "clickToComplete" | "doneColor" | "showInBar";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="fuyu-todo-ring-set__group">
      <h3 className="fuyu-todo-ring-set__title">{title}</h3>
      {children}
    </div>
  );
}

function Segments<T extends string | number>({
  label,
  value,
  options,
  onPick,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onPick: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="fuyu-todo-ring-set__row">
      <span className="fuyu-todo-ring-set__label">{label}</span>
      <div className="fuyu-todo-ring-set__seg" role="radiogroup" aria-label={label}>
        {options.map(([option, caption]) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            className={value === option ? "fuyu-todo-ring-set__seg-item is-on" : "fuyu-todo-ring-set__seg-item"}
            onClick={() => onPick(option)}
          >
            {caption}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, hint, settings, patch }: { name: FlagKey; label: string; hint?: string; settings: RingSettings; patch: Patch }) {
  return (
    <div className="fuyu-todo-ring-set__flag">
      <label className="fuyu-todo-ring-set__check">
        <input type="checkbox" checked={settings[name]} onChange={(e) => patch({ [name]: e.target.checked })} />
        <span>{label}</span>
      </label>
      {hint && <p className="fuyu-todo-ring-set__hint">{hint}</p>}
    </div>
  );
}

const COUNT_OPTIONS = SHOW_COUNTS.map((count) => [count, count === 0 ? text.showNone : String(count)] as const);

export default function apply(ctx: Context) {
  function TodoRingSection() {
    const { state, failed, invoke } = useRing(ctx);
    const { settings } = state;
    const patch: Patch = (next) => void invoke(METHODS.setSettings, next, text.saveFailed);
    const counts = (SHOW_COUNTS as readonly number[]).includes(settings.showCount)
      ? COUNT_OPTIONS
      : [...COUNT_OPTIONS, [settings.showCount, String(settings.showCount)] as const];
    return (
      <section className="fuyu-todo-ring-set">
        <Group title={text.contentTitle}>
          <Segments
            label={text.scope}
            value={settings.scope}
            options={[
              ["today", text.scopeToday],
              ["overdue", text.scopeOverdue],
            ]}
            onPick={(scope) => patch({ scope })}
          />
          <p className="fuyu-todo-ring-set__hint">{text.scopeHint}</p>
          <Segments label={text.showCount} value={settings.showCount} options={counts} onPick={(showCount) => patch({ showCount })} />
          <Flag name="clickToComplete" label={text.clickToComplete} hint={text.clickHint} settings={settings} patch={patch} />
        </Group>
        <Group title={text.displayTitle}>
          <Flag name="doneColor" label={text.doneColor} settings={settings} patch={patch} />
        </Group>
        <Group title={text.barTitle}>
          <Flag name="showInBar" label={text.showInBar} settings={settings} patch={patch} />
          <Segments
            label={text.barStyle}
            value={settings.barStyle}
            disabled={!settings.showInBar}
            options={[
              ["ring-count", text.barRingCount],
              ["ring", text.barRing],
              ["left", text.barRemaining],
            ]}
            onPick={(barStyle) => patch({ barStyle })}
          />
        </Group>
        {failed && <p className="fuyu-todo-ring-set__hint is-error">{failed}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", { id: "todo-ring", category: "pluginsV3", component: TodoRingSection });
}
