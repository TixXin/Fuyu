import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState } from "react";
import { INTERVAL_OPTIONS, LAYOUT_OPTIONS, type Layout, type MonitorConfig } from "./protocol.ts";
import { TEXT, formatBytes, formatUptime } from "./text.ts";
import { useSystemMonitor } from "./useSystemMonitor.ts";
import "./ui/settings.css";

type Draft = Omit<MonitorConfig, "locale">;

type Toggle = "showOnBar" | "barCpu" | "barMemory" | "barCpuTemperature" | "barGpuTemperature" | "backgroundHistory";

function draftOf(config: MonitorConfig): Draft {
  return {
    intervalMs: config.intervalMs,
    showOnBar: config.showOnBar,
    barCpu: config.barCpu,
    barMemory: config.barMemory,
    barCpuTemperature: config.barCpuTemperature,
    barGpuTemperature: config.barGpuTemperature,
    backgroundHistory: config.backgroundHistory,
    layout: config.layout,
  };
}

export default function apply(ctx: Context) {
  function SystemMonitorSection() {
    const { state, locale, error, updateConfig, refresh } = useSystemMonitor(ctx, false);
    const copy = TEXT[locale];
    const { config, features, sample } = state;
    const [draft, setDraft] = useState<Draft>(() => draftOf(config));

    const savedKey = JSON.stringify(draftOf(config));
    useEffect(() => {
      setDraft(JSON.parse(savedKey) as Draft);
    }, [savedKey]);

    const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

    const check = (key: Toggle, label: string, disabled = false, hint?: string) => (
      <label className="fuyu-sysmon-settings__check">
        <span className="fuyu-sysmon-settings__text">
          <span>{label}</span>
          {hint && <span className="fuyu-sysmon-settings__hint">{hint}</span>}
        </span>
        <input
          type="checkbox"
          checked={draft[key]}
          disabled={disabled}
          onChange={(event) => set(key, event.target.checked)}
        />
      </label>
    );

    return (
      <section className="fuyu-sysmon-settings">
        <div className="fuyu-sysmon-settings__top">
          <h3 className="fuyu-sysmon-settings__title">{copy.title}</h3>
          {sample && (
            <span className="fuyu-sysmon-settings__sub">
              {`${sample.hostname} · ${formatBytes(sample.memoryTotalBytes)} · ${formatUptime(sample.uptimeSec, locale)}`}
            </span>
          )}
        </div>

        <label className="fuyu-sysmon-settings__field">
          <span className="fuyu-sysmon-settings__label">{copy.layoutLabel}</span>
          <select
            className="fuyu-sysmon-settings__input"
            value={draft.layout}
            onChange={(event) => set("layout", event.target.value as Layout)}
          >
            {LAYOUT_OPTIONS.map((layout) => (
              <option key={layout} value={layout}>
                {copy.layoutOption[layout]}
              </option>
            ))}
          </select>
        </label>

        {state.platform === "windows" &&
          check("backgroundHistory", copy.backgroundHistory, false, copy.backgroundHistoryHint)}
        {check("showOnBar", copy.showOnBar)}
        {check("barCpu", copy.barCpu, !draft.showOnBar)}
        {check("barMemory", copy.barMemory, !draft.showOnBar)}
        {features.cpuTemperature && check("barCpuTemperature", copy.barCpuTemperature, !draft.showOnBar)}
        {features.gpuTemperature && check("barGpuTemperature", copy.barGpuTemperature, !draft.showOnBar)}

        <label className="fuyu-sysmon-settings__field">
          <span className="fuyu-sysmon-settings__label">{copy.intervalLabel}</span>
          <select
            className="fuyu-sysmon-settings__input"
            value={String(draft.intervalMs)}
            disabled={!draft.showOnBar}
            onChange={(event) => set("intervalMs", Number(event.target.value) || 2000)}
          >
            {INTERVAL_OPTIONS.map((ms) => (
              <option key={ms} value={String(ms)}>
                {copy.intervalOption(ms)}
              </option>
            ))}
          </select>
          <span className="fuyu-sysmon-settings__hint">{copy.intervalHint}</span>
        </label>

        <div className="fuyu-sysmon-settings__actions">
          <button type="button" className="fuyu-sysmon-settings__button" onClick={() => void updateConfig(draft)}>
            {copy.save}
          </button>
          <button
            type="button"
            className="fuyu-sysmon-settings__button fuyu-sysmon-settings__button--secondary"
            onClick={refresh}
          >
            {copy.refresh}
          </button>
        </div>

        {error && <p className="fuyu-sysmon-settings__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/system-monitor",
    category: "pluginsV3",
    component: SystemMonitorSection,
  });
}
