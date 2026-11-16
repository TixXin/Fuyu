import type { TrayMenuAction, TrayMenuState } from "./api";
import type { TrayAgents, TrayMedia, TrayMeeting } from "./trayCard";

export type TrayMenuShortcuts = {
  screenshot: string | null;
  translate: string | null;
  clipboard: string | null;
};

export type TrayCardData = {
  state: TrayMenuState;
  shortcuts: TrayMenuShortcuts;
  off: ReadonlySet<string>;
  dnd: boolean;
  autostart: boolean;
  media: TrayMedia | null;
  meeting: TrayMeeting | null;
  agents: TrayAgents | null;
  now: number;
};

export type TrayCardHandlers = {
  onAction: (action: TrayMenuAction, arg?: string) => void;
  onDnd: () => void;
  onAutostart: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onJoin: () => void;
};

export type TrayCardProps = { data: TrayCardData; handlers: TrayCardHandlers };
