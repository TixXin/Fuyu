import type { SessionRemoval } from "../../features/agent-status/useHiddenSessions";
import type { ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { PluginViewPage } from "../../features/plugin-views/PluginViewPage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import type { useIslandMessagePanel } from "./useIslandMessagePanel";
import type { useQQNotifications } from "../../features/messages/qq-notifications/QQNotifications";
import type { useWeChatReminders } from "../../features/messages/wechat/WeChatReminders";
import type { useMail } from "../../features/messages/mail/MailPanel";
import type { useTodos } from "../../features/todos/useTodos";
import type { AgentSessionSummary } from "../../features/agent-status/api";
import type { UnseenSessions } from "../../features/agent-status/useUnseenSessions";
import type { AgentUsages } from "../../features/agent-status/usage";
import type { IslandSettings } from "../../lib/settings/types";
import type { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import type { CalendarState } from "../../features/calendar/useCalendar";
import type { useFileShelf } from "../../features/file-shelf/useFileShelf";
import type { useIslandAgentAlerts } from "./useIslandAgentAlerts";
import type { useIslandFeatures } from "./useIslandFeatures";
import type { useIslandNavigation } from "./useIslandNavigation";
import type { useMessageView } from "./useMessageView";
import type { usePluginPages } from "./usePluginPages";
import { openSettingsWindow } from "../settings/api";
import { getTodoScrollStartRows } from "./layout";
import { pageSlot } from "./slots/pageSlot";
import "./slots/builtins";

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

export type IslandPageProps = IslandPagesProps & {
  onOpenSettings: typeof openSettingsWindow;
  todoScrollStartRows: number;
  extraView?: { label: string; content: ReactNode };
  embedded?: boolean;
};

export function IslandPages(props: IslandPagesProps): ReactNode {
  const { page, mode, pluginPages, features, settings } = props;
  const t = useTranslation();
  const entries = useSlotEntries(pageSlot);
  const pageProps: IslandPageProps = { ...props, onOpenSettings: openSettingsWindow, todoScrollStartRows: getTodoScrollStartRows(settings.maxPanelHeight) };
  const folded = entries.find((entry) => entry.fold?.into === page && entry.fold.when(features));
  if (folded?.fold) {
    const Folded = folded.component;
    pageProps.extraView = { label: folded.fold.label(t), content: <Folded {...pageProps} embedded /> };
  }
  return (
    <>
      <SlotView slot={pageSlot} props={pageProps} select={(items) => items.filter((item) => item.id === page)} />
      {pluginPages.entry && <PluginViewPage entry={pluginPages.entry} isOpen={mode === "expanded"} />}
    </>
  );
}
