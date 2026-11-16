import type { ComponentProps } from "react";
import { defineSlot, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { ClipboardCopyNotice, ClipboardCopyNoticeActions } from "../ClipboardCopyNotice";
import { ClipboardHistoryPanel } from "../ClipboardHistoryPanel";
import { clipboardIsland } from "./islandState";
import { OWNER } from "./owner.ts";
import { islandPage } from "./page.ts";

type ClipboardPageProps = {
  extraView?: ComponentProps<typeof ClipboardHistoryPanel>["extraView"];
};

const pageSlot = defineSlot<ClipboardPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function ClipboardPage({ extraView }: ClipboardPageProps) {
  const clipboard = clipboardIsland.use()?.clipboard;
  if (!clipboard) return null;
  const {
    clipboardHistory,
    copyClipboardHistoryItem,
    toggleClipboardHistoryFavorite,
    updateClipboardHistoryItemNote,
    deleteClipboardHistoryItem,
    clearClipboardHistoryItems,
  } = clipboard;
  return (
    <ClipboardHistoryPanel
      snapshot={clipboardHistory}
      onCopyItem={copyClipboardHistoryItem}
      onToggleFavorite={(id) => void toggleClipboardHistoryFavorite(id)}
      onUpdateNote={updateClipboardHistoryItemNote}
      onDeleteItem={(id) => void deleteClipboardHistoryItem(id)}
      onClear={() => void clearClipboardHistoryItems()}
      extraView={extraView}
    />
  );
}

pageSlot.add({ ...islandPage, component: ClipboardPage }, OWNER);

const noticeSlot = defineSlot<object, IslandNoticeMeta<object>>("island.notice/v1");

function CopyContent() {
  const copyCard = clipboardIsland.use()?.copyCard;
  return copyCard ? <ClipboardCopyNotice key={copyCard.current?.key} card={copyCard} /> : null;
}

function CopyActions() {
  const copyCard = clipboardIsland.use()?.copyCard;
  return copyCard ? <ClipboardCopyNoticeActions card={copyCard} /> : null;
}

noticeSlot.add({ id: "copy", order: 50, component: CopyContent, actions: CopyActions }, OWNER);
