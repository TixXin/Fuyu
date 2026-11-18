import { AGENTS } from "../../../src/features/agent-status/agents";
import type { AgentSessionSummary, AgentStatusSnapshot, AgentUsage } from "../../../src/features/agent-status/api";
import type { AgentApprovalRequest } from "../../../src/features/agent-status/approvals/api";
import type { CalendarEvent } from "../../../src/features/calendar/api";
import type { ClipboardHistoryItem } from "../../../src/features/clipboard/api";
import type { MediaState } from "../../../src/features/media/api";
import type { Lyrics } from "../../../src/features/media/lyrics/api";
import type { MailContent, MailSnapshot } from "../../../src/features/messages/mail/api";
import type { QQNotificationSnapshot } from "../../../src/features/messages/qq-notifications/api";
import type { ReminderSnapshot } from "../../../src/features/messages/wechat/api";
import type { BuiltinPlugin } from "../../../src/features/plugin-kernel/api";
import type { MarketSnapshot } from "../../../src/features/plugins/api";
import type { PluginViewsSnapshot } from "../../../src/features/plugin-views/api";
import type { TodosData } from "../../../src/features/todos/api";

export type World = {
  todos: TodosData;
  todosRevision: number;
  media: MediaState;
  audioPeak: () => number;
  lyrics: Record<string, Lyrics>;
  clipboard: ClipboardHistoryItem[];
  sessions: AgentSessionSummary[];
  agentStatus: AgentStatusSnapshot;
  usage: AgentUsage | null;
  codexUsage: AgentUsage | null;
  builtins: BuiltinPlugin[] | null;
  approvals: AgentApprovalRequest[];
  qq: QQNotificationSnapshot;
  wechat: ReminderSnapshot;
  mail: MailSnapshot;
  mailBodies: Record<string, MailContent>;
  calendar: CalendarEvent[];
  translations: Record<string, string>;
  settings: Record<string, unknown>;
  plugins: PluginViewsSnapshot;
  wallpaper: string | null;
  market: MarketSnapshot | null;
  calls: { command: string; args: Record<string, unknown> }[];
};

export const SILENT_MEDIA: MediaState = {
  available: false, audioActive: false, audioPeak: 0, playbackStatus: "unavailable",
  title: null, artist: null, album: null, thumbnail: null, positionMs: 0, durationMs: 0,
  canSeek: false, canNext: false, canPrevious: false, shuffleActive: null, canShuffle: false,
  repeatMode: "unknown", canRepeat: false, volume: -1, sourceApp: null, activeSessionId: null,
  sessions: [], updatedAt: 0,
};

export function createWorld(): World {
  return {
    todos: { date: "", todos: [], scheduled: [], archives: [], dailyNote: "", activeTodoId: null },
    todosRevision: 1,
    media: SILENT_MEDIA,
    audioPeak: () => 0,
    lyrics: {},
    clipboard: [],
    sessions: [],
    agentStatus: {
      ...Object.fromEntries(Object.keys(AGENTS).map((agent) => [agent, { phase: "idle", updatedAt: 0 }])),
      updatedAt: 0, statusPath: "",
    } as AgentStatusSnapshot,
    usage: null,
    codexUsage: null,
    builtins: null,
    approvals: [],
    qq: { revision: 1, enabled: true, status: "listening", items: [], error: null },
    wechat: {
      revision: 1, enabled: true, status: "listening", pending: false, lastAttentionAt: null, error: null,
      message: null, items: [], exposeUi: false, exposeStatus: null, hideTaskbarButton: false,
    },
    mail: {
      revision: 1, email: "hello@fuyu.ing", configured: true, enabled: true, syncing: false,
      status: "connected", unreadCount: 0, items: [], lastSyncedAt: null, error: null,
    },
    mailBodies: {},
    calendar: [],
    translations: {},
    settings: {},
    plugins: { views: [], status: [], statusItems: [] },
    wallpaper: null,
    market: null,
    calls: [],
  };
}
