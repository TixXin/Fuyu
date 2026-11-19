import type { AgentSessionSummary } from "../api";
import type { AgentNoticeStack } from "../agentSettings.ts";
import { sessionProject } from "../../../lib/agent-sessions/project.ts";
import { getAgentProviderLabel } from "../status.ts";
import { noticeTone, type AgentNoticeTone } from "./noticeOptions.ts";

export type AgentNoticeStackItem = {
  key: string;
  provider: string;
  tone: AgentNoticeTone;
  title: string;
  state: string;
};

export const PILE_ICONS = 3;
export const WING_PILE_ICONS = 2;
export const PEEK_SLIVERS = 2;

export function activeIndex(items: readonly AgentNoticeStackItem[], activeKey: string | null) {
  const index = items.findIndex((item) => item.key === activeKey);
  return index < 0 ? 0 : index;
}

export function stackCount(mode: AgentNoticeStack, total: number, index: number): string | null {
  if (total < 2) return null;
  if (mode === "count") return `+${total - 1}`;
  if (mode === "peek") return `${index + 1}/${total}`;
  return null;
}

export function peekSlivers(items: readonly AgentNoticeStackItem[], index: number) {
  return items.filter((_, at) => at !== index).slice(0, PEEK_SLIVERS);
}

export function pileOf(items: readonly AgentNoticeStackItem[], index: number, limit = PILE_ICONS) {
  const active = items[index];
  const ordered = active ? [active, ...items.filter((_, at) => at !== index)] : [...items];
  return { shown: ordered.slice(0, limit), extra: Math.max(0, ordered.length - limit) };
}

export function stackItemOf(key: string, session: AgentSessionSummary, states: Readonly<Record<AgentNoticeTone, string>>): AgentNoticeStackItem {
  const tone = noticeTone(session);
  const title = session.title ?? sessionProject(session.cwd) ?? getAgentProviderLabel(session.provider);
  return { key, provider: session.provider, tone, title, state: states[tone] };
}
