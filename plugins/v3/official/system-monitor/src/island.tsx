import type { Context } from "@fuyu/plugin-base";
import { TEXT, formatBytes, formatUptime } from "./text.ts";
import { useSystemMonitor } from "./useSystemMonitor.ts";
import "./styles.css";

function MonitorIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

export default function apply(ctx: Context) {
  function MonitorPage() {
    const { state, locale, error, refresh } = useSystemMonitor(ctx, true);
    const copy = TEXT[locale];
    const { sample } = state;

    return (
      <div className="fuyu-sysmon">
        <div className="fuyu-sysmon__top">
          <div className="fuyu-sysmon__head">
            <h3 className="fuyu-sysmon__title">{copy.title}</h3>
            {sample && (
              <span className="fuyu-sysmon__sub">
                {`${sample.hostname} · ${sample.arch}`}
              </span>
            )}
          </div>
          <button type="button" className="fuyu-sysmon__button" onClick={refresh}>
            {copy.refresh}
          </button>
        </div>

        {sample && (
          <>
            <div className="fuyu-sysmon__cards">
              <div className="fuyu-sysmon__card">
                <div className="fuyu-sysmon__card-row">
                  <span className="fuyu-sysmon__label">{copy.cpu}</span>
                  <strong className="fuyu-sysmon__value">{`${sample.cpuPercent.toFixed(1)}%`}</strong>
                </div>
                <div className="fuyu-sysmon__track">
                  <div
                    className="fuyu-sysmon__fill"
                    style={{ width: `${Math.min(100, Math.max(0, sample.cpuPercent))}%` }}
                  />
                </div>
                {sample.cpuModel && (
                  <span className="fuyu-sysmon__detail" title={sample.cpuModel}>
                    {sample.cpuModel}
                  </span>
                )}
              </div>

              <div className="fuyu-sysmon__card">
                <div className="fuyu-sysmon__card-row">
                  <span className="fuyu-sysmon__label">{copy.memory}</span>
                  <strong className="fuyu-sysmon__value">{`${sample.memoryPercent.toFixed(1)}%`}</strong>
                </div>
                <div className="fuyu-sysmon__track">
                  <div
                    className="fuyu-sysmon__fill"
                    style={{ width: `${Math.min(100, Math.max(0, sample.memoryPercent))}%` }}
                  />
                </div>
                <span className="fuyu-sysmon__detail">
                  {`${formatBytes(sample.memoryUsedBytes)} / ${formatBytes(sample.memoryTotalBytes)}`}
                </span>
              </div>
            </div>

            {sample.cores.length > 0 && (
              <div className="fuyu-sysmon__block">
                <span className="fuyu-sysmon__heading">{copy.coresHeading(sample.cores.length)}</span>
                <div className="fuyu-sysmon__cores">
                  {sample.cores.map((pct, index) => (
                    <div key={index} className="fuyu-sysmon__core">
                      <div className="fuyu-sysmon__core-meta">
                        <span className="fuyu-sysmon__core-id">{`#${index + 1}`}</span>
                        <span className="fuyu-sysmon__core-pct">{`${pct}%`}</span>
                      </div>
                      <div className="fuyu-sysmon__core-track">
                        <div
                          className="fuyu-sysmon__fill"
                          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="fuyu-sysmon__footer">
              <span>{`${copy.host}: ${sample.hostname} (${sample.arch})`}</span>
              <span>{`${copy.uptime}: ${formatUptime(sample.uptimeSec, locale)}`}</span>
            </div>
          </>
        )}

        {error && <p className="fuyu-sysmon__note">{error}</p>}
      </div>
    );
  }

  function MonitorCollapsed() {
    const { state, locale } = useSystemMonitor(ctx, false);
    const copy = TEXT[locale];
    const { config, sample } = state;
    if (!config.showOnBar || (!config.barCpu && !config.barMemory) || !sample) {
      return null;
    }
    const parts: string[] = [];
    if (config.barCpu) parts.push(`${copy.barCpuShort} ${Math.round(sample.cpuPercent)}%`);
    if (config.barMemory) parts.push(`${copy.barMemShort} ${Math.round(sample.memoryPercent)}%`);
    const label = parts.join(" · ");
    const tooltip = `${sample.hostname} · ${copy.cpu} ${sample.cpuPercent.toFixed(1)}% · ${copy.memory} ${formatBytes(sample.memoryUsedBytes)}/${formatBytes(sample.memoryTotalBytes)} · ${copy.uptime} ${formatUptime(sample.uptimeSec, locale)}`;
    return (
      <span className="fuyu-sysmon-bar" title={tooltip}>
        {label}
      </span>
    );
  }

  ctx.slots.add("island.page/v1", {
    id: "@fuyu/system-monitor",
    component: MonitorPage,
    icon: MonitorIcon,
  });

  ctx.slots.add("island.collapsed/v1", {
    id: "@fuyu/system-monitor",
    component: MonitorCollapsed,
    hideable: true,
  });
}
