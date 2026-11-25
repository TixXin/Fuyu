import type { KeyboardEvent, MouseEvent, ReactNode, RefCallback, UIEvent } from "react";
import type { AgentCardEffects, AgentHostDisplay } from "../agentSettings";
import type { AgentSessionSummary } from "../api";
import type { SessionLight } from "../sessionLight";
import type { pillParts } from "../sessionPill";

export type PillParts = ReturnType<typeof pillParts>;

export type SessionViewItem = {
  key: string;
  session: AgentSessionSummary;
  title: string;
  project: string | null;
  model: string | null;
  pill: PillParts;
  pillMode: string | null;
  pillTitle: string;
  light: SessionLight;
  active: boolean;
  urgent: boolean;
  phaseLabel: string;
  showPhase: boolean;
  lightText: string;
  statusParts: ReactNode[];
  age: string;
  showAge: boolean;
  unseen: boolean;
  looked: boolean;
  orbit: boolean;
  notFound: string | null;
  depth: number;
  subagents?: ReactNode;
  menu?: ReactNode;
  archive?: ReactNode;
  hoverSuppressed: boolean;
  onOpen: () => void;
  onReveal?: () => void;
  onCopyPath?: () => void;
  onArchive?: () => void;
};

export type SessionViewGroup = {
  key: string;
  host: string | null;
  project: string | null;
  heading: boolean;
  items: SessionViewItem[];
};

export type SessionViewProps = {
  groups: SessionViewGroup[];
  items: SessionViewItem[];
  hostDisplay: AgentHostDisplay;
  showElapsed: boolean;
  showModel: boolean;
  showActivity: boolean;
  cardEffects: AgentCardEffects;
  hasRemoval: boolean;
  hasMenu: boolean;
  listRef: RefCallback<HTMLUListElement>;
  fade: { top: boolean; bottom: boolean };
  onScroll: (event: UIEvent<HTMLUListElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
};
