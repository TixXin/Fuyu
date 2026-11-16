import type { QuotaAlert } from "../../src/features/agent-status/quotaAlerts";
import { quotaAlertState } from "../../src/features/agent-status/plugin/islandState";
import type { AgentSession } from "../../src/features/agent-status/session";
import type { CollapsedMeeting } from "../../src/features/calendar/upcoming";
import { meetingState } from "../../src/features/calendar/plugin/islandState";
import { useMeetingContributions } from "../../src/features/calendar/plugin/meetingLines";
import type { DeviceAlert } from "../../src/features/device-events/api";
import { useMemo } from "react";
import type { MediaState } from "../../src/features/media/api";
import type { CurrentLyric } from "../../src/features/media/lyrics/useCurrentLyric";
import { DEFAULT_MEDIA_STATE } from "../../src/features/media/mediaState";
import { mediaIsland, type MediaController } from "../../src/features/media/plugin/islandState";
import { lyricLineContribution } from "../../src/features/media/plugin/lyricLine";
import type { LevelChange } from "../../src/features/system-levels/api";
import { deviceAlertState } from "../../src/features/device-events/plugin/islandState";
import type { DeviceUse } from "../../src/features/device-use/api";
import { devicesInUse } from "../../src/features/device-use/deviceUse";
import { deviceUseState } from "../../src/features/device-use/plugin/islandState";
import type { IslandContribution } from "../../src/features/plugin-kernel/islandContributions";
import { useIslandContributions } from "../../src/features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../src/i18n";
import { levelState } from "../../src/features/system-levels/plugin/islandState";
import { todoLine } from "../../src/features/todos/plugin/islandState";
import { todoLineContributions } from "../../src/features/todos/plugin/todoLines";
import { translationPeekState } from "../../src/features/translation/plugin/islandState";
import { useLegacyLines } from "../../src/windows/island/legacyLines";

type FixtureLines = {
  barText?: boolean;
  agentSession?: AgentSession | null;
  lyricLine?: CurrentLyric | null;
  todoTitle?: string | null;
  todoCount?: number | null;
  meeting?: CollapsedMeeting | null;
  translationPeek?: string | null;
  agentIconWidth?: number;
  deviceAlert?: DeviceAlert | null;
  quotaAlert?: QuotaAlert | null;
  levelPopup?: LevelChange | null;
  deviceUse?: DeviceUse;
  media?: MediaState | null;
  sideCover?: boolean;
  status?: { state: string; label: string };
};

const NO_DEVICES: DeviceUse = { camera: [], microphone: [] };
const IDLE = { state: "idle", label: "" };

export function useFixtureLines({ barText = true, agentSession = null, lyricLine = null, todoTitle = null, todoCount = null, meeting = null, translationPeek = null, agentIconWidth = 0, deviceAlert = null, quotaAlert = null, levelPopup = null, deviceUse = NO_DEVICES, media = null, sideCover = false, status = IDLE }: FixtureLines) {
  const t = useTranslation();
  quotaAlertState.useProvide(quotaAlert);
  useIslandContributions("builtin", "fixture.agents", [{ kind: "status", state: status.state, label: status.label }, ...(quotaAlert ? [{ kind: "alert", item: "quota" } as const] : [])]);
  deviceAlertState.useProvide(deviceAlert);
  levelState.useProvide(levelPopup);
  const alerts: IslandContribution[] = [];
  if (deviceAlert) alerts.push({ kind: "alert", item: "device" });
  if (levelPopup) alerts.push({ kind: "alert", item: "level" });
  for (const device of devicesInUse(deviceUse)) alerts.push({ kind: "side", item: `device-${device}`, height: 28 });
  useIslandContributions("builtin", "fixture.features", alerts);
  deviceUseState.useProvide(deviceUse);
  translationPeekState.useProvide(translationPeek);
  useIslandContributions("translation", "fixture.peek", translationPeek === null ? [] : [{ kind: "line", item: "translation.peek", priority: 70, always: true, bare: true, drop: true, action: "translation.open-peek", label: translationPeek }]);
  const lyric = agentSession ? null : lyricLine;
  mediaIsland.useProvide(useMemo(() => ({ media: { mediaState: media ?? DEFAULT_MEDIA_STATE } as MediaController, lyricLine: lyric, sideCover }), [media, lyric, sideCover]));
  const mediaList: IslandContribution[] = [];
  const line = lyricLineContribution(lyric, true, t);
  if (line) mediaList.push(line);
  if (media && (media.available || media.audioActive)) mediaList.push({ kind: "side", item: "music", height: sideCover && media.thumbnail ? 40 : 28 });
  if (media?.audioActive) mediaList.push({ kind: "hint", key: "media.audible" });
  if (media?.playbackStatus === "playing") mediaList.push({ kind: "hint", key: "media.playing" });
  useIslandContributions("builtin", "fixture.media", mediaList);
  const todo = useMemo(() => ({ title: todoTitle, count: todoCount }), [todoTitle, todoCount]);
  todoLine.useProvide(todo);
  useIslandContributions("builtin", "fixture.todos", todoLineContributions(todo, t));
  meetingState.useProvide(meeting);
  useIslandContributions("calendar", "fixture.meeting", useMeetingContributions(meeting, barText));
  return useLegacyLines({
    agentSession,
    interjecting: false,
    agentIconWidth,
  });
}
