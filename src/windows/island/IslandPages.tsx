import type { SessionRemoval } from "../../features/agent-status/useHiddenSessions";
import type { ReactNode } from "react";
import { PluginViewPage } from "../../features/plugin-views/PluginViewPage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import type { useIslandMessagePanel } from "./useIslandMessagePanel";
import type { useQQNotifications } from "../../features/messages/qq-notifications/QQNotifications";
import type { useWeChatReminders } from "../../features/messages/wechat/WeChatReminders";
import type { useMail } from "../../features/messages/mail/MailPanel";
import type { useTodos } from "../../features/todos/useTodos";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import type { UnseenSessions } from "../../features/agent-status/useUnseenSessions";
import type { AgentUsages } from "../../features/agent-status/usage";
import type { IslandSettings } from "../../features/appearance/types";
import type { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import type { useMediaState } from "../../features/media/useMediaState";
import type { PlayingLyrics } from "../../features/media/lyrics/usePlayingLyrics";
import type { CalendarState } from "../../features/calendar/useCalendar";
import type { useFileShelf } from "../../features/file-shelf/useFileShelf";
import type { useIslandAgentAlerts } from "./useIslandAgentAlerts";
import type { useIslandFeatures } from "./useIslandFeatures";
import type { useIslandNavigation } from "./useIslandNavigation";
import type { useMessageView } from "./useMessageView";
import type { usePluginPages } from "./usePluginPages";
import { pageSlot } from "./slots/pageSlot";
import "./slots/pages";

type MessageView = ReturnType<typeof useMessageView>;
type AgentAlerts = ReturnType<typeof useIslandAgentAlerts>;

export type IslandPagesProps = {
  page: ReturnType<typeof useIslandNavigation>["page"];
  mode: ReturnType<typeof useIslandNavigation>["mode"];
  settings: IslandSettings;
  features: ReturnType<typeof useIslandFeatures>["features"];
  qqMail: ReturnType<typeof useMail>;
  qqNotifications: ReturnType<typeof useQQNotifications>;
  wechatReminders: ReturnType<typeof useWeChatReminders>;
  messageSource: MessageView["messageSource"];
  messagePanel?: ReturnType<typeof useIslandMessagePanel>;
  openMessages: MessageView["openMessages"];
  media: ReturnType<typeof useMediaState>;
  lyrics?: PlayingLyrics;
  clipboard: ReturnType<typeof useClipboardHistory>;
  agentSessions: AgentSessionSummary[];
  unseenAgentSessions: UnseenSessions;
  agentRemoval: SessionRemoval;
  alertedSession: AgentAlerts["alertedSession"];
  agentApprovals: AgentAlerts["approvals"];
  agentUsages: AgentUsages;
  pluginPages: ReturnType<typeof usePluginPages>;
  fileShelf: ReturnType<typeof useFileShelf>;
  isShelfDropping: boolean;
  notebookProps: ReturnType<typeof useTodos>["notebookProps"];
  addTodoOn?: ReturnType<typeof useTodos>["addTodoOn"];
  calendar: CalendarState;
};

export function IslandPages(props: IslandPagesProps): ReactNode {
  const { page, mode, pluginPages } = props;
  return (
    <>
      <SlotView slot={pageSlot} props={props} select={(items) => items.filter((item) => item.id === page)} />
      {pluginPages.entry && <PluginViewPage entry={pluginPages.entry} isOpen={mode === "expanded"} />}
    </>
  );
}
