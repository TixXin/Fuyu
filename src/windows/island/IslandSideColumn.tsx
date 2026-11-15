import { useEffect, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { Inbox, ListTodo, Mail, MessageCircle } from "lucide-react";
import type { AgentVisualState } from "../../features/agent-status/status";
import type { DeviceUse } from "../../features/device-use/api";
import { DeviceUseIndicator } from "../../features/device-use/DeviceUseIndicator";
import { devicesInUse } from "../../features/device-use/deviceUse";
import type { MediaState } from "../../features/media/api";
import { MusicWaveButton } from "../../features/media/MusicWaveButton";
import type { MessageSource } from "../../features/messages/messagePreview";
import { useTranslation } from "../../i18n";
import { layoutSideColumn, SIDE_COVER_HEIGHT, SIDE_ROW_HEIGHT, type SideColumnLayout } from "./sideColumn";
import { setIslandSideColumn } from "./api";
import type { IslandPage } from "./types";
import { useWindowDragGesture } from "./useWindowDragGesture";
import "./IslandSideColumn.css";

export type SideColumnRow = { id: string; height: number; node: ReactNode };

export type SideColumnInput = {
  agentVisualState: AgentVisualState;
  agentSessionCount: number | null;
  unreadCount: number;
  hasMail: boolean;
  todoCount: number | null;
  shelfCount: number | null;
  showMusic: boolean;
  showCover: boolean;
  mediaState: MediaState;
  deviceUse: DeviceUse;
  gauges: readonly { id: string; node: ReactNode }[];
};

type IslandSideColumnProps = {
  label: string;
  hot: string | null;
  layout: SideColumnLayout<SideColumnRow>;
  onOpen: () => void;
  onWindowDragStart: () => void;
};

function stop(event: { stopPropagation: () => void }, action: () => void) {
  event.stopPropagation();
  action();
}

export function useSideColumnRows(input: SideColumnInput, onOpenPage: (page: IslandPage) => void, onOpenMessages: (source: MessageSource) => void) {
  const t = useTranslation();
  const rows: SideColumnRow[] = [];
  const count = input.agentSessionCount ?? 0;
  rows.push({
    id: "agent",
    height: SIDE_ROW_HEIGHT,
    node: (
      <button type="button" className={`island-side-ring island-side-ring--${input.agentVisualState}`} aria-label={t.agent.sessions.activeCount(count)} onClick={(event) => stop(event, () => onOpenPage("agents"))}>
        {count > 0 ? count : <span className="island-side-ring__dot" aria-hidden="true" />}
      </button>
    ),
  });
  if (input.unreadCount > 0) {
    rows.push({ id: "unread", height: SIDE_ROW_HEIGHT, node: (
      <button type="button" className="island-side-cell" aria-label={t.messages.unreadCount(input.unreadCount)} onClick={(event) => stop(event, () => onOpenPage("qq"))}>
        <MessageCircle size={16} strokeWidth={1.6} aria-hidden="true" />
        <span className="island-side-cell__num">{input.unreadCount}</span>
      </button>
    ) });
  }
  if (input.hasMail) {
    rows.push({ id: "mail", height: SIDE_ROW_HEIGHT, node: (
      <button type="button" className="island-side-cell" aria-label={t.messages.newMailLabel} onClick={(event) => stop(event, () => onOpenMessages("qqMail"))}>
        <Mail size={16} strokeWidth={1.6} aria-hidden="true" />
        <span className="island-side-cell__dot" aria-hidden="true" />
      </button>
    ) });
  }
  if (input.showMusic && (input.mediaState.available || input.mediaState.audioActive)) {
    const playing = input.mediaState.playbackStatus === "playing";
    const cover = input.showCover ? input.mediaState.thumbnail : null;
    rows.push({ id: "music", height: cover ? SIDE_COVER_HEIGHT : SIDE_ROW_HEIGHT, node: cover ? (
      <button type="button" className="island-side-cover" aria-label={t.island.openMusic} onClick={(event) => stop(event, () => onOpenPage("music"))}>
        <img src={cover} alt="" draggable={false} />
        {playing && <span className="island-side-cover__playing" aria-hidden="true" />}
      </button>
    ) : (
      <MusicWaveButton isAvailable isPlaying={playing} audioPeak={input.mediaState.audioPeak} label={t.island.openMusic} onClick={() => onOpenPage("music")} />
    ) });
  }
  if (input.todoCount !== null && input.todoCount > 0) {
    rows.push({ id: "todo", height: SIDE_ROW_HEIGHT, node: (
      <button type="button" className="island-side-cell" aria-label={t.island.pendingTodos(input.todoCount)} onClick={(event) => stop(event, () => onOpenPage("todo"))}>
        <ListTodo size={16} strokeWidth={1.6} aria-hidden="true" />
        <span className="island-side-cell__num">{input.todoCount}</span>
      </button>
    ) });
  }
  for (const gauge of input.gauges) rows.push({ id: gauge.id, height: SIDE_ROW_HEIGHT, node: gauge.node });
  for (const device of devicesInUse(input.deviceUse)) {
    rows.push({ id: `device-${device}`, height: SIDE_ROW_HEIGHT, node: <DeviceUseIndicator deviceUse={{ ...input.deviceUse, [device === "camera" ? "microphone" : "camera"]: [] }} /> });
  }
  if (input.shelfCount !== null && input.shelfCount > 0) {
    rows.push({ id: "shelf", height: SIDE_ROW_HEIGHT, node: (
      <button type="button" className="island-side-cell" aria-label={t.island.shelfCount(input.shelfCount)} onClick={(event) => stop(event, () => onOpenPage("shelf"))}>
        <Inbox size={16} strokeWidth={1.6} aria-hidden="true" />
        <span className="island-side-cell__num">{input.shelfCount}</span>
      </button>
    ) });
  }
  return layoutSideColumn(rows);
}

export function IslandSideColumn({ label, hot, layout, onOpen, onWindowDragStart }: IslandSideColumnProps) {
  const t = useTranslation();
  const { didDragRef, prepareWindowDrag, handleWindowDragMove, cancelWindowDrag } = useWindowDragGesture(false, onWindowDragStart);

  useEffect(() => {
    if (!isTauri()) return;
    void setIslandSideColumn(layout.height).catch((error) => console.error("Failed to size the side island", error));
  }, [layout.height]);

  return (
    <div
      className="island-side-column"
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={prepareWindowDrag}
      onPointerMove={handleWindowDragMove}
      onPointerUp={cancelWindowDrag}
      onPointerCancel={cancelWindowDrag}
      onClick={() => {
        if (!didDragRef.current) onOpen();
      }}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {layout.shown.map((row, index) => (
        <span key={row.id} data-side-item={row.id} className={`island-side-row${hot === row.id ? " island-side-row--hot" : ""}`} style={{ top: layout.offsets[index], height: row.height }}>
          {row.node}
        </span>
      ))}
      {layout.hidden > 0 && (
        <button
          type="button"
          className="island-side-row island-side-more"
          style={{ top: layout.offsets[layout.shown.length] }}
          aria-label={t.island.sideMore(layout.hidden)}
          onClick={(event) => stop(event, onOpen)}
        >
          +{layout.hidden}
        </button>
      )}
    </div>
  );
}
