import type { ReactNode } from "react";
import { useTranslation } from "../../i18n";
import { PluginViewPage } from "../../features/plugin-views/PluginViewPage";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import type { useIslandMessagePanel } from "./useIslandMessagePanel";
import type { useQQNotifications } from "../../features/messages/qq-notifications/QQNotifications";
import type { useWeChatReminders } from "../../features/messages/wechat/WeChatReminders";
import type { useMail } from "../../features/messages/mail/MailPanel";
import type { IslandSettings } from "../../lib/settings/types";
import type { useClipboardHistory } from "../../features/clipboard/useClipboardHistory";
import type { useFileShelf } from "../../features/file-shelf/useFileShelf";
import type { useIslandFeatures } from "./useIslandFeatures";
import type { useIslandNavigation } from "./useIslandNavigation";
import type { useMessageView } from "./useMessageView";
import type { usePluginPages } from "./usePluginPages";
import { openSettingsWindow } from "../settings/api";
import { getTodoScrollStartRows } from "./layout";
import { pageSlot } from "./slots/pageSlot";
import "./slots/builtins";

type MessageView = ReturnType<typeof useMessageView>;

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
  pluginPages: ReturnType<typeof usePluginPages>;
  fileShelf: ReturnType<typeof useFileShelf>;
  isShelfDropping: boolean;
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
