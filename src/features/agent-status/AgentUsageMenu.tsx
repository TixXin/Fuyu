import { Check, SlidersHorizontal } from "lucide-react";
import { RowMenu, type RowMenuItem } from "../../components/list/RowMenu";
import { useTranslation } from "../../i18n";
import { AGENTS } from "./agents";
import type { AgentUsageItem, AgentUsageReset } from "./agentSettings";
import type { UsageView } from "./usage";

export type UsageViewChange = (patch: { agentUsageHidden?: AgentUsageItem[]; agentUsageTightest?: boolean; agentUsageReset?: AgentUsageReset }) => void;

const PROVIDERS: readonly AgentUsageItem[] = ["claudeCode", "codex"];
const WINDOWS: readonly AgentUsageItem[] = ["fiveHour", "sevenDay", "models"];

function mark(on: boolean) {
  return <Check size={14} strokeWidth={2.4} style={{ opacity: on ? 1 : 0 }} aria-hidden="true" />;
}

export function AgentUsageMenu({ view, onChange }: { view: UsageView; onChange: UsageViewChange }) {
  const t = useTranslation();
  const text = t.agent.usage;
  const shown = (item: AgentUsageItem) => !view.hidden.includes(item);
  const toggle = (item: AgentUsageItem, group: readonly AgentUsageItem[]): RowMenuItem => {
    const on = shown(item);
    const last = on && group.filter(shown).length === 1;
    const label = item === "claudeCode" || item === "codex" ? AGENTS[item].label : item === "models" ? text.models : text[item];
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
    ...PROVIDERS.map((item) => toggle(item, PROVIDERS)),
    ...WINDOWS.map((item) => toggle(item, WINDOWS)),
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
