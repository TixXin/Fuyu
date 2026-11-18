import type { Context } from "@fuyu/plugin-base";
import { useEffect, useState } from "react";
import { INTERVAL_OPTIONS, TEXT, formatBytes, formatUptime } from "./types.ts";
import { useSystemMonitor } from "./useSystemMonitor.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function SystemMonitorSection() {
    const { state, locale, error, updateConfig, refresh } = useSystemMonitor(ctx, false);
    const copy = TEXT[locale];

    const [intervalMs, setIntervalMs] = useState(state.config.intervalMs);
    const [showOnBar, setShowOnBar] = useState(state.config.showOnBar);
    const [barCpu, setBarCpu] = useState(state.config.barCpu);
    const [barMemory, setBarMemory] = useState(state.config.barMemory);

    useEffect(() => {
      setIntervalMs(state.config.intervalMs);
      setShowOnBar(state.config.showOnBar);
      setBarCpu(state.config.barCpu);
      setBarMemory(state.config.barMemory);
    }, [
      state.config.intervalMs,
      state.config.showOnBar,
      state.config.barCpu,
      state.config.barMemory,
    ]);

    const onSave = () => {
      void updateConfig({
        intervalMs,
        showOnBar,
        barCpu,
        barMemory,
      });
    };

    const { sample } = state;

    return (
      <section className="fuyu-sysmon-settings">
        <div className="fuyu-sysmon__top">
          <h3 className="fuyu-sysmon__title">{copy.title}</h3>
          {sample && (
            <span className="fuyu-sysmon__sub">
              {`${sample.hostname} · ${formatBytes(sample.memoryTotalBytes)} · ${formatUptime(sample.uptimeSec, locale)}`}
            </span>
          )}
        </div>

        <label className="fuyu-sysmon-settings__field">
          <span className="fuyu-sysmon-settings__label">{copy.intervalLabel}</span>
          <select
            className="fuyu-sysmon-settings__input"
            value={String(intervalMs)}
            onChange={(event) => setIntervalMs(Number(event.target.value) || 2000)}
          >
            {INTERVAL_OPTIONS.map((ms) => (
              <option key={ms} value={String(ms)}>
                {copy.intervalOption(ms)}
              </option>
            ))}
          </select>
        </label>

        <label className="fuyu-sysmon-settings__check">
          <span>{copy.showOnBar}</span>
          <input
            type="checkbox"
            checked={showOnBar}
            onChange={(event) => setShowOnBar(event.target.checked)}
          />
        </label>

        <label className="fuyu-sysmon-settings__check">
          <span>{copy.barCpu}</span>
          <input
            type="checkbox"
            checked={barCpu}
            disabled={!showOnBar}
            onChange={(event) => setBarCpu(event.target.checked)}
          />
        </label>

        <label className="fuyu-sysmon-settings__check">
          <span>{copy.barMemory}</span>
          <input
            type="checkbox"
            checked={barMemory}
            disabled={!showOnBar}
            onChange={(event) => setBarMemory(event.target.checked)}
          />
        </label>

        <div className="fuyu-sysmon-settings__actions">
          <button type="button" className="fuyu-sysmon__button" onClick={onSave}>
            {copy.save}
          </button>
          <button
            type="button"
            className="fuyu-sysmon__button fuyu-sysmon__button--secondary"
            onClick={refresh}
          >
            {copy.refresh}
          </button>
        </div>

        {!state.sampling && <p className="fuyu-sysmon__note">{copy.idleHint}</p>}
        {error && <p className="fuyu-sysmon__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/system-monitor",
    category: "pluginsV3",
    component: SystemMonitorSection,
  });
}
