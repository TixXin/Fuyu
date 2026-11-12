import { useTranslation } from "../../i18n";
import type { PluginCallRecord } from "./api";

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour12: false });

export function PluginCallLog({ calls }: { calls: PluginCallRecord[] }) {
  const t = useTranslation();
  const labels = t.settings.plugins.calls;
  const line = (call: PluginCallRecord) => {
    const outcome = call.outcome === "error" && call.status ? `${labels.outcome.error} ${call.status}` : labels.outcome[call.outcome];
    return `${time(call.at)}  ${call.method}  ${outcome}${call.count > 1 ? `  ×${call.count}` : ""}`;
  };

  return (
    <details className="plugin-card__log">
      <summary>{labels.title}</summary>
      <p className="settings-section__hint">{labels.hint}</p>
      <pre>{calls.length > 0 ? calls.map(line).join("\n") : labels.none}</pre>
    </details>
  );
}
