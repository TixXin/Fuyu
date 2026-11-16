import { LINE_PRIORITY, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { useLineBelow } from "../../plugin-kernel/useIslandContributions";
import type { CollapsedMeeting } from "../upcoming";
import { useMeetingBeat } from "../useMeetingBeat";

export function useMeetingContributions(meeting: CollapsedMeeting | null, barText: boolean): IslandContribution[] {
  const sharing = useLineBelow(LINE_PRIORITY.meeting)?.shareable === true;
  const beat = useMeetingBeat(barText && sharing ? meeting?.upcoming ?? null : null);
  if (!barText || meeting === null) return [];
  const list: IslandContribution[] = [];
  if (!sharing || beat) list.push({ kind: "line", item: "calendar.meeting", priority: LINE_PRIORITY.meeting, page: "calendar", bare: true });
  list.push({ kind: "trail", item: "calendar.join" });
  return list;
}
