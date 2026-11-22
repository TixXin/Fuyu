import { LINE_PRIORITY, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { useLineBelow } from "../../plugin-kernel/useIslandContributions";
import type { CollapsedMeeting } from "../upcoming";
import { useMeetingBeat } from "../useMeetingBeat";
import { meetingLineContributions, meetingSharesBar } from "./meetingLine";

export function useMeetingContributions(meeting: CollapsedMeeting | null, barText: boolean, priority: number | null = LINE_PRIORITY.meeting): IslandContribution[] {
  const sharing = meetingSharesBar(useLineBelow(priority ?? LINE_PRIORITY.meeting));
  const beat = useMeetingBeat(barText && sharing && priority !== null ? meeting?.upcoming ?? null : null);
  return meetingLineContributions(meeting !== null, barText, sharing, beat, priority);
}
