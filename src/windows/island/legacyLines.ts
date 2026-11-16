import type { AgentSession } from "../../features/agent-status/session";
import type { CollapsedMeeting } from "../../features/calendar/upcoming";
import { useMeetingBeat } from "../../features/calendar/useMeetingBeat";
import type { CurrentLyric } from "../../features/media/lyrics/useCurrentLyric";
import { LINE_PRIORITY, type IslandContribution } from "../../features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import type { CollapsedLineSources } from "./slots/line";

const AGENT_ICON_TEXT = "MM";

type LegacyLineInput = {
  barText: boolean;
  agentSession: AgentSession | null;
  interjecting: boolean;
  agentIconWidth: number;
  lyricLine: CurrentLyric | null;
  lyricsFirst: boolean;
  todoTitle: string | null;
  todoCount: number | null;
  meeting: CollapsedMeeting | null;
  translationPeek: string | null;
  screenshotPeek: string | null;
};

export function useLegacyLines(input: LegacyLineInput): CollapsedLineSources {
  const t = useTranslation();
  const { barText, agentSession, lyricLine, todoTitle, todoCount, meeting, translationPeek, screenshotPeek } = input;
  const meetingBeat = useMeetingBeat(barText && lyricLine ? meeting?.upcoming ?? null : null);
  const meetingDue = barText && meeting !== null;
  const list: IslandContribution[] = [];
  const peek = translationPeek ?? screenshotPeek;
  if (peek !== null) {
    list.push({ kind: "line", item: translationPeek !== null ? "translation.peek" : "screenshot.text", priority: LINE_PRIORITY.peek, always: true, bare: true, drop: true, action: "translation.open-peek", label: t.translator.peekLabel(peek) });
  }
  if (meetingDue) {
    if (lyricLine === null || meetingBeat) list.push({ kind: "line", item: "calendar.meeting", priority: LINE_PRIORITY.meeting, page: "calendar", bare: true });
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
  if (lyricLine) {
    const priority = input.lyricsFirst ? LINE_PRIORITY.lyricsFirst : LINE_PRIORITY.lyrics;
    const measure = lyricLine.longest !== null ? AGENT_ICON_TEXT + lyricLine.longest : undefined;
    list.push(lyricLine.text
      ? { kind: "line", item: "media.lyric", priority, measure, page: "music", lead: true, shareable: true, label: (lyricLine.song ? t.island.nowPlaying : t.island.lyricLine)(lyricLine.text) }
      : { kind: "line", item: "media.lyric", priority, measure, page: "music", lead: true, shareable: true, reserve: true });
  }
  if (todoTitle !== null) list.push({ kind: "line", item: "todos.title", priority: LINE_PRIORITY.todoTitle, measure: todoTitle, label: t.messages.collapsedTask(todoTitle) });
  if (todoCount !== null) list.push({ kind: "line", item: "todos.count", priority: LINE_PRIORITY.todoCount, measure: t.island.pendingTodos(todoCount), center: true, label: t.island.pendingTodos(todoCount) });
  useIslandContributions("builtin", "legacy.lines", list);
  return { agentSession, lyricLine, meeting, todoTitle, todoCount, translationPeek, screenshotPeek };
}
