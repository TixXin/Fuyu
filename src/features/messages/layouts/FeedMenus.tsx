import { ArrowUpRight, Check, CheckCheck, Columns3, Ellipsis, GalleryVerticalEnd, Inbox, LayoutGrid, ListTree, PenSquare, RefreshCw, Settings2, SquareStack, Trash2, type LucideIcon } from "lucide-react";
import { RowMenu, type RowMenuItem } from "../../../components/list/RowMenu";
import { useTranslation } from "../../../i18n";
import { MESSAGE_LAYOUTS, type MessageLayout } from "../feed/messageLayout";
import type { MessageFeed } from "../feed/types";
import type { MessageSource } from "../messagePreview";

export const LAYOUT_ICONS: Record<MessageLayout, LucideIcon> = {
  focus: GalleryVerticalEnd,
  inbox: Inbox,
  reader: Columns3,
  stacks: SquareStack,
  board: LayoutGrid,
  timeline: ListTree,
};

export type FeedChrome = {
  layout: MessageLayout;
  onLayout: (layout: MessageLayout) => void;
  onDetails: (source: MessageSource) => void;
};

export function LayoutMenu({ layout, onLayout }: Pick<FeedChrome, "layout" | "onLayout">) {
  const t = useTranslation();
  const feed = t.messages.feed;
  const Icon = LAYOUT_ICONS[layout];
  const items: RowMenuItem[] = MESSAGE_LAYOUTS.map((id) => {
    const ItemIcon = LAYOUT_ICONS[id];
    return {
      key: id,
      label: feed.layouts[id].name,
      icon: id === layout ? <Check size={14} strokeWidth={2.2} aria-hidden="true" /> : <ItemIcon size={14} strokeWidth={1.8} aria-hidden="true" />,
      onSelect: () => onLayout(id),
    };
  });
  return <RowMenu label={`${feed.layoutTitle}：${feed.layouts[layout].name}`} items={items} buttonClassName="feed-icon-button"><Icon size={15} strokeWidth={1.8} aria-hidden="true" /></RowMenu>;
}

export function FeedMoreMenu({ feed, chrome, source = null }: { feed: MessageFeed; chrome: FeedChrome; source?: MessageSource | null }) {
  const t = useTranslation();
  const text = t.messages.feed;
  const { actions, sources, items } = feed;
  const scoped = source ? sources.filter((entry) => entry.id === source) : sources;
  const unread = items.some((item) => item.unread > 0 && (!source || item.source === source));
  const chats = scoped.filter((entry) => entry.id !== "qqMail");
  const menu: RowMenuItem[] = [
    { key: "read-all", label: text.readAll, icon: <CheckCheck size={14} strokeWidth={1.8} aria-hidden="true" />, disabled: !unread, onSelect: () => actions.readAll(source ?? undefined) },
    { key: "refresh", label: text.refresh, icon: <RefreshCw size={14} strokeWidth={1.8} aria-hidden="true" />, onSelect: () => actions.refresh(source ?? undefined) },
    ...(actions.compose && (!source || source === "qqMail") ? [{ key: "compose", label: text.compose, icon: <PenSquare size={14} strokeWidth={1.8} aria-hidden="true" />, onSelect: actions.compose }] : []),
    ...scoped.map((entry) => ({ key: `open-${entry.id}`, label: text.openApp(entry.label), icon: <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />, onSelect: () => actions.openApp(entry.id) })),
    ...scoped.map((entry) => ({ key: `details-${entry.id}`, label: text.sourceDetails(entry.label), icon: <Settings2 size={14} strokeWidth={1.8} aria-hidden="true" />, onSelect: () => chrome.onDetails(entry.id) })),
    ...(chats.length > 0 ? [{ key: "clear", label: text.clear(source ? chats[0]?.label ?? null : null), icon: <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />, danger: true, onSelect: () => actions.clear(source ?? undefined) }] : []),
  ];
  return <RowMenu label={text.more} items={menu} buttonClassName="feed-icon-button"><Ellipsis size={15} strokeWidth={1.8} aria-hidden="true" /></RowMenu>;
}
