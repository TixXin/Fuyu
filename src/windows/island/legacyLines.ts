import type { AgentSession } from "../../features/agent-status/session";
import type { CollapsedMeeting } from "../../features/calendar/upcoming";
import { useMeetingBeat } from "../../features/calendar/useMeetingBeat";
import { LINE_PRIORITY, type IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions, useLineBelow } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import type { CollapsedLineSources } from "./slots/line";

const AGENT_ICON_TEXT = "MM";

type LegacyLineInput = {
  barText: boolean;
  agentSession: AgentSession | null;
  interjecting: boolean;
  agentIconWidth: number;
  todoTitle: string | null;
  todoCount: number | null;
  meeting: CollapsedMeeting | null;
  screenshotPeek: string | null;
};

export function useLegacyLines(input: LegacyLineInput): CollapsedLineSources {
  const t = useTranslation();
  const { barText, agentSession, todoTitle, todoCount, meeting, screenshotPeek } = input;
  const sharing = useLineBelow(LINE_PRIORITY.meeting)?.shareable === true;
  const meetingBeat = useMeetingBeat(barText && sharing ? meeting?.upcoming ?? null : null);
  const meetingDue = barText && meeting !== null;
  const list: IslandContribution[] = [];
  if (screenshotPeek !== null) {
    list.push({ kind: "line", item: "screenshot.text", priority: LINE_PRIORITY.screenshotPeek, always: true, bare: true, drop: true, action: "translation.open-peek", label: t.translator.peekLabel(screenshotPeek) });
  }
  if (meetingDue) {
    if (!sharing || meetingBeat) list.push({ kind: "line", item: "calendar.meeting", priority: LINE_PRIORITY.meeting, page: "calendar", bare: true });
    list.push({ kind: "trail", item: "calendar.join" });
  }
  if (agentSession) {
    list.push({
      kind: "line",
      item: "agent-status.session",
      priority: input.interjecting ? LINE_PRIORITY.agentInterjection : LINE_PRIORITY.agentTitle,
      measure: AGENT_ICON_TEXT + agentSession.title,
      extra: input.agentIconWidth,
      page: "agents",
      lead: true,
      handle: true,
      label: t.island.agentSession(agentSession.label, agentSession.title),
    });
  }
  if (todoTitle !== null) list.push({ kind: "line", item: "todos.title", priority: LINE_PRIORITY.todoTitle, measure: todoTitle, label: t.messages.collapsedTask(todoTitle) });
  if (todoCount !== null) list.push({ kind: "line", item: "todos.count", priority: LINE_PRIORITY.todoCount, measure: t.island.pendingTodos(todoCount), center: true, label: t.island.pendingTodos(todoCount) });
  useIslandContributions("builtin", "legacy.lines", list);
  return { agentSession, meeting, todoTitle, todoCount, screenshotPeek };
}
