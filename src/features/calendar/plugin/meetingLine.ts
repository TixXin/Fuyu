import { LINE_PRIORITY, type IslandContribution, type IslandLineContribution } from "../../plugin-kernel/islandContributions.ts";

export function meetingSharesBar(below: IslandLineContribution | null): boolean {
  return below?.shareable === true;
}

export function meetingLineContributions(hasMeeting: boolean, barText: boolean, sharing: boolean, beat: boolean): IslandContribution[] {
  if (!barText || !hasMeeting) return [];
  const list: IslandContribution[] = [];
  if (!sharing || beat) list.push({ kind: "line", item: "calendar.meeting", priority: LINE_PRIORITY.meeting, page: "calendar", bare: true });
  list.push({ kind: "trail", item: "calendar.join" });
  return list;
}
