import type { Context } from "@fuyu/plugin-base";
import { useState, type ReactNode } from "react";
import { islandApi } from "./island-api.ts";
import {
  HISTORY_OPTIONS,
  RECENT_SHOWN_OPTIONS,
  RESCAN_OPTIONS,
  type LauncherSettings,
} from "./settingsModel.ts";
import { ExcludedApps, ExtraDirs } from "./settingsLists.tsx";
import { text } from "./text.ts";
import { useLauncher } from "./useLauncher.ts";
import "./settings.css";

type Patch = (patch: Partial<LauncherSettings>) => void;
type FlagKey = "autoCollapse" | "showFolder" | "showCount" | "recordRecent";

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="fuyu-launcher-set__group">
      <h3 className="fuyu-launcher-set__title">{title}</h3>
      {hint && <p className="fuyu-launcher-set__hint">{hint}</p>}
      {children}
    </div>
  );
}

function Choice<T extends string | number>({
  label,
  value,
  options,
  onPick,
  disabled,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<[T, string]>;
  onPick: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="fuyu-launcher-set__row">
      <span className="fuyu-launcher-set__label">{label}</span>
      <div className="fuyu-launcher-set__seg" role="radiogroup" aria-label={label}>
        {options.map(([option, caption]) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={value === option}
            disabled={disabled}
            className={value === option ? "fuyu-launcher-set__seg-item is-on" : "fuyu-launcher-set__seg-item"}
            onClick={() => onPick(option)}
          >
            {caption}
          </button>
        ))}
      </div>
    </div>
  );
}

function Flag({ name, label, settings, patch }: { name: FlagKey; label: string; settings: LauncherSettings; patch: Patch }) {
  return (
    <label className="fuyu-launcher-set__check">
      <input type="checkbox" checked={settings[name]} onChange={(event) => patch({ [name]: event.target.checked })} />
      <span>{label}</span>
    </label>
  );
}

export default function apply(ctx: Context) {
  const canCollapse = Boolean(islandApi(ctx)?.collapse);

  function LauncherSettingsSection() {
    const launcher = useLauncher(ctx);
    const { state, busy, error, rescan, clearRecent, setSettings } = launcher;
    const { settings } = state;
    const [notice, setNotice] = useState<string | null>(null);
    const patch: Patch = (next) => {
      setNotice(null);
      void setSettings(next);
    };

    const handleRescan = async () => {
      setNotice(null);
      const next = await rescan();
      if (next) setNotice(text.rescanDone(next.totalCount));
    };

    const handleClearRecent = async () => {
      setNotice(null);
      const next = await clearRecent();
      if (next) setNotice(text.clearedDone);
    };

    return (
      <section className="fuyu-launcher-set">
        <Group title={text.contentTitle}>
          <Choice
            label={text.emptyView}
            value={settings.emptyView}
            options={[
              ["recent", text.emptyRecent],
              ["all", text.emptyAll],
            ]}
            onPick={(emptyView) => patch({ emptyView })}
          />
          <Choice
            label={text.recentShown}
            value={settings.recentShown}
            options={RECENT_SHOWN_OPTIONS.map((count) => [count, String(count)] as [number, string])}
            onPick={(recentShown) => patch({ recentShown })}
            disabled={settings.emptyView !== "recent" || !settings.recordRecent}
          />
          <Flag name="recordRecent" label={text.recordRecent} settings={settings} patch={patch} />
          <Choice
            label={text.historyLimit}
            value={settings.historyLimit}
            options={HISTORY_OPTIONS.map((count) => [count, text.historyItems(count)] as [number, string])}
            onPick={(historyLimit) => patch({ historyLimit })}
            disabled={!settings.recordRecent}
          />
          <div className="fuyu-launcher-set__actions">
            <button
              type="button"
              className="fuyu-launcher-set__button"
              disabled={busy || state.recentCount === 0}
              onClick={() => void handleClearRecent()}
            >
              {text.clearRecent}
            </button>
          </div>
        </Group>

        <Group title={text.displayTitle}>
          <Flag name="showFolder" label={text.showFolder} settings={settings} patch={patch} />
          <Flag name="showCount" label={text.showCount} settings={settings} patch={patch} />
          {canCollapse && <Flag name="autoCollapse" label={text.autoCollapse} settings={settings} patch={patch} />}
        </Group>

        <Group title={text.scanTitle} hint={text.scanSummary(state.totalCount, state.excludedApps.length)}>
          <div className="fuyu-launcher-set__actions">
            <button type="button" className="fuyu-launcher-set__button" disabled={busy} onClick={() => void handleRescan()}>
              {text.rescan}
            </button>
          </div>
          <Choice
            label={text.rescanEvery}
            value={settings.rescanMinutes}
            options={RESCAN_OPTIONS.map(
              (minutes) => [minutes, minutes === 0 ? text.rescanNever : text.rescanMinutes(minutes)] as [number, string],
            )}
            onPick={(rescanMinutes) => patch({ rescanMinutes })}
          />
        </Group>

        <Group title={text.extraDirsTitle} hint={text.extraDirsHint}>
          <ExtraDirs launcher={launcher} />
        </Group>

        <Group title={text.excludedTitle} hint={text.excludedHint}>
          <ExcludedApps launcher={launcher} />
        </Group>

        {notice && !error && <p className="fuyu-launcher-set__hint">{notice}</p>}
        {error && !error.includes("missing-dir") && <p className="fuyu-launcher-set__hint">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/launcher",
    category: "pluginsV3",
    component: LauncherSettingsSection,
  });
}
