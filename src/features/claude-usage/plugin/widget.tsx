import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { clickOnly } from "../../../components/island-widget/clickOnly";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { MiniRing } from "../../../components/MiniRing";
import { useTranslation } from "../../../i18n";
import { runIslandAction } from "../../plugin-kernel/useIslandContributions";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { hasRingNumbers, nextUsageReset, USAGE_PROVIDERS, usageCardLines, usageRings, type UsageProvider } from "../usageRing";
import { useClaudeUsage } from "../useClaudeUsage";
import { useUsageConfig } from "../useUsageConfig";
import { islandWidgets, OPEN_AGENTS_ACTION, OPEN_USAGE_SETTINGS_ACTION } from "./widgets.ts";
import "./widget.css";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

const openSettings = () => void runIslandAction(OPEN_USAGE_SETTINGS_ACTION);

function UsageWidget({ provider }: { provider: UsageProvider }) {
  const t = useTranslation();
  const text = t.claudeUsage;
  const [{ show }] = useUsageConfig();
  const remaining = show === "remaining";
  const { usage, agentsOff, now, refresh } = useClaudeUsage(provider.id);
  const rings = useMemo(() => usageRings(usage, now, remaining, provider.color), [usage, now, remaining, provider]);
  const details = useMemo(() => usageCardLines(usage, now, text, remaining, provider).map((line) => line.text).join("\n"), [usage, now, text, remaining, provider]);
  const label = t.islandWidgets.widgets.usage(provider.name);
  const percent = (index: number) => `${Math.round((rings[index]?.value ?? 0) * 100)}%`;
  const reset = nextUsageReset(usage, now);
  const onAgentsPage = provider.id === "claudeCode" || provider.id === "codex";
  const open = () => {
    if (!onAgentsPage || !runIslandAction(OPEN_AGENTS_ACTION)) refresh();
  };
  if (!hasRingNumbers(usage, now)) {
    const hint = agentsOff ? `${details}\n${text.needsAgents}` : details;
    return (
      <WidgetFrame icon={Gauge} title={provider.name} className="usage-widget">
        <div className="usage-widget__empty" title={hint}>
          <span>{agentsOff ? text.widget.agentsOff : text.widget.noData}</span>
          <button type="button" onClick={clickOnly(openSettings)}>
            {text.widget.setUp}
          </button>
        </div>
      </WidgetFrame>
    );
  }
  return (
    <WidgetFrame icon={Gauge} title={provider.name} className="usage-widget">
      <button className="usage-widget__body" type="button" title={details} aria-label={`${label}: ${details}`} onClick={clickOnly(open)}>
        <span className="usage-widget__top">
          <MiniRing rings={rings} size={30} strokeWidth={3.5} gap={1.5} ariaLabel={label} />
          <dl className="usage-widget__numbers">
            <dt>{text.fiveHour}</dt>
            <dd>{percent(0)}</dd>
            <dt>{text.sevenDay}</dt>
            <dd>{percent(1)}</dd>
          </dl>
        </span>
        {reset ? <span className="usage-widget__reset">{text.widget.resets(reset)}</span> : null}
      </button>
    </WidgetFrame>
  );
}

USAGE_PROVIDERS.forEach((provider, index) => {
  const meta = islandWidgets[index];
  widgetSlot.add({ ...meta, component: function ProviderUsageWidget() { return <UsageWidget provider={provider} />; } }, meta.owner);
});
