import type { QuotaAlert } from "../../src/features/agent-status/quotaAlerts";
import type { AgentSession } from "../../src/features/agent-status/session";
import type { CollapsedMeeting } from "../../src/features/calendar/upcoming";
import type { DeviceAlert } from "../../src/features/device-events/api";
import type { CurrentLyric } from "../../src/features/media/lyrics/useCurrentLyric";
import type { LevelChange } from "../../src/features/system-levels/api";
import { useLegacyAlerts } from "../../src/windows/island/legacyAlerts";
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
};

export function useFixtureLines({ barText = true, agentSession = null, lyricLine = null, todoTitle = null, todoCount = null, meeting = null, translationPeek = null, agentIconWidth = 0, deviceAlert = null, quotaAlert = null, levelPopup = null }: FixtureLines) {
  useLegacyAlerts({ deviceAlert, quotaAlert, levelPopup });
  return useLegacyLines({
    barText,
    agentSession,
    interjecting: false,
    agentIconWidth,
    lyricLine: agentSession ? null : lyricLine,
    lyricsFirst: true,
    todoTitle,
    todoCount,
    meeting,
    translationPeek,
    screenshotPeek: null,
  });
}
