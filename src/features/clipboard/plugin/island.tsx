import type { ComponentProps } from "react";
import { defineSlot, type IslandNoticeMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { ClipboardCopyNotice, ClipboardCopyNoticeActions } from "../ClipboardCopyNotice";
import type { ClipboardCopyCardState } from "../useClipboardCopyCard";
import { ClipboardHistoryPanel } from "../ClipboardHistoryPanel";
import type { useClipboardHistory } from "../useClipboardHistory";
import { islandPage } from "./page.ts";

type ClipboardPageProps = {
  clipboard: ReturnType<typeof useClipboardHistory>;
  extraView?: ComponentProps<typeof ClipboardHistoryPanel>["extraView"];
};

const pageSlot = defineSlot<ClipboardPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function ClipboardPage({ clipboard, extraView }: ClipboardPageProps) {
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

pageSlot.add({ ...islandPage, component: ClipboardPage });

type NoticeSources = { copyCard: ClipboardCopyCardState };

const noticeSlot = defineSlot<NoticeSources, IslandNoticeMeta<NoticeSources>>("island.notice/v1");

function CopyContent({ copyCard }: NoticeSources) {
  return <ClipboardCopyNotice key={copyCard.current?.key} card={copyCard} />;
}

function CopyActions({ copyCard }: NoticeSources) {
  return <ClipboardCopyNoticeActions card={copyCard} />;
}

noticeSlot.add({ id: "copy", order: 50, active: ({ copyCard }) => Boolean(copyCard.current), component: CopyContent, actions: CopyActions });
