import { Check, SlidersHorizontal } from "lucide-react";
import { RowMenu, type RowMenuItem } from "../../components/list/RowMenu";
import { useTranslation } from "../../i18n";
import { AGENT_USAGE_COLUMNS, type AgentUsageItem, type AgentUsageReset, type AgentUsageSource } from "./agentSettings";
import { USAGE_SOURCE_LABELS, type UsageView } from "./usage";

export type UsageViewChange = (patch: { agentUsageHidden?: AgentUsageItem[]; agentUsageTightest?: boolean; agentUsageReset?: AgentUsageReset }) => void;

function mark(on: boolean) {
  return <Check size={14} strokeWidth={2.4} style={{ opacity: on ? 1 : 0 }} aria-hidden="true" />;
}

export function AgentUsageMenu({ view, sources, onChange }: { view: UsageView; sources: readonly AgentUsageSource[]; onChange: UsageViewChange }) {
  const t = useTranslation();
  const text = t.agent.usage;
  const shown = (item: AgentUsageItem) => !view.hidden.includes(item);
  const toggle = (item: AgentUsageItem, group: readonly AgentUsageItem[]): RowMenuItem => {
    const on = shown(item);
    const last = on && group.filter(shown).length === 1;
    const label = item === "models" ? text.models : item === "fiveHour" || item === "sevenDay" ? text[item] : USAGE_SOURCE_LABELS[item];
    return {
      key: item,
      label,
      icon: mark(on),
      keepOpen: true,
      disabled: last,
      onSelect: () => onChange({ agentUsageHidden: on ? [...view.hidden, item] : view.hidden.filter((hidden) => hidden !== item) }),
    };
  };
  const items: RowMenuItem[] = [
    ...(sources.length > 1 ? sources.map((item) => toggle(item, sources)) : []),
    ...AGENT_USAGE_COLUMNS.map((item) => toggle(item, AGENT_USAGE_COLUMNS)),
    { key: "tightest", label: text.tightest, icon: mark(view.tightest), keepOpen: true, onSelect: () => onChange({ agentUsageTightest: !view.tightest }) },
    { key: "reset", label: text.reset, icon: mark(view.reset !== "off"), keepOpen: true, onSelect: () => onChange({ agentUsageReset: view.reset === "off" ? "tightest" : "off" }) },
  ];

  return (
    <span className="agent-usage__menu">
      <RowMenu label={text.menu} items={items} buttonClassName="agent-usage__menu-button">
        <SlidersHorizontal size={13} strokeWidth={2.2} aria-hidden="true" />
      </RowMenu>
    </span>
  );
}
