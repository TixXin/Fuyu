import { useRef } from "react";
import { useTranslation, type Translations } from "../../../i18n";
import type { IslandNotice } from "../../../lib/island-notices/service";
import { ISLAND_SIDE_ROW_HEIGHT, type IslandContribution } from "../../plugin-kernel/islandContributions";
import { useIslandAction, useIslandContributions } from "../../plugin-kernel/useIslandContributions";
import { imUnreadTotal, isImSource } from "../im-sources/imSourcesState";
import { messagePreviewText } from "../messagePreview";
import type { SummaryGrow } from "../island/summaryFit";
import { messagesIsland, type MessagesIsland } from "./islandState";
import { OWNER } from "./owner.ts";

const MESSAGE_ARRIVALS_CHROME_HEIGHT = 86;

export type MessagesIslandFlags = {
  showsMessage: boolean;
  grow?: SummaryGrow | null;
  hold: boolean;
  arrivalsHeight: number | null;
  maxPanelHeight: number;
  pages: { qq: boolean; wechat: boolean };
};

export function messageArrivalsPanelHeight(listHeight: number, maxPanelHeight: number) {
  return Math.min(MESSAGE_ARRIVALS_CHROME_HEIGHT + listHeight, maxPanelHeight);
}

export function messagesContributions(state: MessagesIsland, flags: MessagesIslandFlags, t: Translations): IslandContribution[] {
  const { qq, wechat, mail, im, preview } = state;
  const extraUnread = im ? imUnreadTotal(im.snapshots) : 0;
  const list: IslandContribution[] = [{ kind: "summary", item: "messages.summary", ...(flags.grow && { grow: { width: flags.grow.width, height: flags.grow.height } }) }];
  if (flags.showsMessage) list.push({ kind: "reveal", reveal: "always", pauseIdle: true, pauseHover: true }, { kind: "busy" }, { kind: "hint", key: "message" });
  if (preview) {
    list.push({
      kind: "preview",
      item: "messages",
      key: `${preview.source}:${preview.id ?? preview.receivedAt}`,
      label: t.messages.openPreview(messagePreviewText(preview, t.messages), t.messages.sourceLabels[preview.source]),
      hot: preview.source === "qqMail" ? "mail" : "unread",
      action: "messages.preview",
      ...(preview.source !== "plugin" && { open: "messages.open-preview" }),
    });
  }
  if (qq.snapshot.items.length > 0 || wechat.snapshot.pending || extraUnread > 0) {
    list.push({ kind: "side", item: "unread", height: ISLAND_SIDE_ROW_HEIGHT }, { kind: "hint", key: "side.badge" });
  }
  if (mail.preview !== null) list.push({ kind: "side", item: "mail", height: ISLAND_SIDE_ROW_HEIGHT }, { kind: "hint", key: "messages.mail" });
  if (flags.hold) list.push({ kind: "hold", reason: "messages" });
  if (flags.arrivalsHeight !== null) list.push({ kind: "popup", page: "qq", height: messageArrivalsPanelHeight(flags.arrivalsHeight, flags.maxPanelHeight), open: true });
  list.push({ kind: "page", page: "qq", enabled: flags.pages.qq }, { kind: "page", page: "wechat", enabled: flags.pages.wechat });
  return list;
}

function openPreview({ preview, plugin, mail, qq, wechat, im, open }: MessagesIsland) {
  if (!preview) return;
  const source = preview.source;
  if (source === "plugin") {
    plugin.dismiss();
    return;
  }
  if (source === "qqMail" && mail.preview) {
    open("qqMail");
    void mail.readMail(mail.preview, mail.previewAccount);
    return;
  }
  if (isImSource(source)) {
    void im?.openSource(source).then((opened) => {
      if (opened === false) open(source);
    });
    return;
  }
  const launch = source === "qq" ? qq.openQQ() : wechat.openWeChat(preview.chat);
  void launch.then((opened) => {
    if (opened === false) open(source);
  });
}

function isPluginNotification(value: unknown): value is IslandNotice {
  return typeof value === "object" && value !== null && typeof (value as { pluginId?: unknown }).pluginId === "string";
}

export function useMessagesIsland(state: MessagesIsland | null, flags: MessagesIslandFlags) {
  const t = useTranslation();
  messagesIsland.useProvide(state);
  const latest = useRef(state);
  latest.current = state;
  useIslandAction("messages.preview", state && (() => {
    if (latest.current) openPreview(latest.current);
  }));
  useIslandAction("messages.open-preview", state && (() => {
    const preview = latest.current?.preview;
    if (preview && preview.source !== "plugin") latest.current?.open(preview.source);
  }));
  useIslandAction("notify", state && ((payload) => {
    if (isPluginNotification(payload)) latest.current?.plugin.post(payload);
  }));
  useIslandContributions(OWNER, "messages.island", state ? messagesContributions(state, flags, t) : []);
}
