import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { WidgetFrame } from "../../../components/island-widget/WidgetFrame";
import { MiniRing } from "../../../components/MiniRing";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandWidgetMeta, type IslandWidgetProps } from "../../plugin-kernel/slots";
import { USAGE_PROVIDERS, usageRings, type UsageProvider } from "../usageRing";
import { useClaudeUsage } from "../useClaudeUsage";
import { useUsageConfig } from "../useUsageConfig";
import { islandWidgets } from "./widgets.ts";
import "./widget.css";

const widgetSlot = defineSlot<IslandWidgetProps, IslandWidgetMeta>("island.widget/v1");

function UsageWidget({ provider }: { provider: UsageProvider }) {
  const t = useTranslation();
  const [{ show }] = useUsageConfig();
  const remaining = show === "remaining";
  const { usage, now } = useClaudeUsage(provider.id);
  const rings = useMemo(() => usageRings(usage, now, remaining, provider.color), [usage, now, remaining, provider]);
  const label = t.islandWidgets.widgets.usage(provider.name);
  const percent = (index: number) => (usage ? `${Math.round((rings[index]?.value ?? 0) * 100)}%` : "–");
  return (
    <WidgetFrame icon={Gauge} title={provider.name} className="usage-widget">
      <div className="usage-widget__body">
        <MiniRing rings={rings} size={34} strokeWidth={3.5} gap={1.5} ariaLabel={label} />
        <dl className="usage-widget__numbers">
          <dt>{t.claudeUsage.fiveHour}</dt>
          <dd>{percent(0)}</dd>
          <dt>{t.claudeUsage.sevenDay}</dt>
          <dd>{percent(1)}</dd>
        </dl>
      </div>
    </WidgetFrame>
  );
}

USAGE_PROVIDERS.forEach((provider, index) => {
  const meta = islandWidgets[index];
  widgetSlot.add({ ...meta, component: function ProviderUsageWidget() { return <UsageWidget provider={provider} />; } }, meta.owner);
});
