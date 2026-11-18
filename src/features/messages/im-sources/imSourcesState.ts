import { nextQQPreview, type QQPreviewTiming } from "../qqNotificationTiming.ts";

export const IM_SOURCE_IDS = ["telegram", "discord", "whatsapp", "tim", "feishu", "dingtalk", "wecom"] as const;

export type ImSourceId = (typeof IM_SOURCE_IDS)[number];

export type ImNotificationKind = "toast" | "flash" | "badge";

export type ImSourceStatus =
  | "disabled"
  | "waiting"
  | "listening"
  | "permissionDenied"
  | "permissionRequired"
  | "error";

export type ImNotificationItem = {
  id: string;
  kind: ImNotificationKind;
  title: string;
  body: string;
  createdAt: number;
  unread?: number;
};

export type ImSourceSnapshot = {
  source: ImSourceId;
  revision: number;
  enabled: boolean;
  installed: boolean;
  status: ImSourceStatus;
  items: ImNotificationItem[];
  error: string | null;
};

export type ImPreviewWindow = {
  id: string;
  replacedId: string | null;
  expiresAt: number;
  receivedAt: number;
};

const IM_SOURCE_SET: ReadonlySet<string> = new Set(IM_SOURCE_IDS);

export const WINDOWS_CUSTOM_POPUP_SOURCES: ReadonlySet<ImSourceId> = new Set([
  "telegram",
  "tim",
  "feishu",
  "dingtalk",
  "wecom",
]);

export function isImSource(value: string): value is ImSourceId {
  return IM_SOURCE_SET.has(value);
}

export function emptyImSnapshot(source: ImSourceId): ImSourceSnapshot {
  return {
    source,
    revision: 0,
    enabled: false,
    installed: false,
    status: "disabled",
    items: [],
    error: null,
  };
}

export function createEmptyImSnapshots(): Record<ImSourceId, ImSourceSnapshot> {
  return {
    telegram: emptyImSnapshot("telegram"),
    discord: emptyImSnapshot("discord"),
    whatsapp: emptyImSnapshot("whatsapp"),
    tim: emptyImSnapshot("tim"),
    feishu: emptyImSnapshot("feishu"),
    dingtalk: emptyImSnapshot("dingtalk"),
    wecom: emptyImSnapshot("wecom"),
  };
}

export function createInitialImRevisions(): Record<ImSourceId, number> {
  return {
    telegram: -1,
    discord: -1,
    whatsapp: -1,
    tim: -1,
    feishu: -1,
    dingtalk: -1,
    wecom: -1,
  };
}

export function imAutoClearKey(source: ImSourceId): string {
  return `${source}AutoClear`;
}

export function isImAutoClearEnabled(config: Readonly<Record<string, unknown>>, source: ImSourceId): boolean {
  const value = config[imAutoClearKey(source)];
  return typeof value === "boolean" ? value : true;
}

export function nextImPreviewState(
  prevWindow: ImPreviewWindow | null,
  prevTiming: QQPreviewTiming | null,
  event: {
    newestId: string | null;
    replacedId?: string | null;
    windowVisible: boolean;
    snapshot: { enabled: boolean };
  },
  canPreview: boolean,
  now: number,
): { previewWindow: ImPreviewWindow | null; timing: QQPreviewTiming | null } {
  if (!event.snapshot.enabled || !event.windowVisible || !canPreview) {
    return { previewWindow: null, timing: null };
  }
  if (!event.newestId) {
    return { previewWindow: prevWindow, timing: prevTiming };
  }
  if (event.replacedId && prevWindow && prevWindow.id === event.replacedId) {
    const baseTiming = prevTiming ?? { burstStartedAt: now, lastArrivalAt: now };
    const deadline = baseTiming.burstStartedAt + 10_000;
    const extended = now < deadline ? Math.min(now + 5_000, deadline) : null;
    const expiresAt = extended ?? (prevWindow.expiresAt > now ? prevWindow.expiresAt : null);
    return {
      timing: { burstStartedAt: baseTiming.burstStartedAt, lastArrivalAt: now },
      previewWindow: expiresAt === null
        ? null
        : { id: event.newestId, replacedId: event.replacedId, expiresAt, receivedAt: now },
    };
  }
  const { timing, expiresAt } = nextQQPreview(prevTiming, now);
  return {
    timing,
    previewWindow: expiresAt === null
      ? null
      : { id: event.newestId, replacedId: event.replacedId ?? null, expiresAt, receivedAt: now },
  };
}

export function imSourceBadge(snapshot: Pick<ImSourceSnapshot, "enabled" | "items">): { count: number; dot: boolean } {
  if (!snapshot.enabled || snapshot.items.length === 0) return { count: 0, dot: false };
  const first = snapshot.items[0];
  if (first?.kind === "badge" && typeof first.unread === "number" && first.unread > 0) {
    return { count: first.unread, dot: false };
  }
  if (snapshot.items.every((item) => item.kind === "flash")) {
    return { count: 0, dot: true };
  }
  return { count: snapshot.items.length, dot: false };
}

export function imUnreadTotal(snapshots: Readonly<Record<ImSourceId, Pick<ImSourceSnapshot, "enabled" | "items">>>): number {
  let total = 0;
  for (const id of IM_SOURCE_IDS) {
    const badge = imSourceBadge(snapshots[id]);
    total += badge.count > 0 ? badge.count : badge.dot ? 1 : 0;
  }
  return total;
}

export function firstPendingImSource(
  snapshots: Readonly<Record<ImSourceId, Pick<ImSourceSnapshot, "enabled" | "items">>>,
): ImSourceId | null {
  for (const id of IM_SOURCE_IDS) {
    const s = snapshots[id];
    if (s.enabled && s.items.length > 0) return id;
  }
  return null;
}

export function sortImSourcesForSettings(
  snapshots: Readonly<Record<ImSourceId, Pick<ImSourceSnapshot, "installed" | "enabled">>>,
  options: { isMacOS: boolean },
): ImSourceId[] {
  const visible = IM_SOURCE_IDS.filter((id) => !(options.isMacOS && id === "tim" && !snapshots.tim.installed && !snapshots.tim.enabled));
  const installed = visible.filter((id) => snapshots[id].installed);
  const notInstalled = visible.filter((id) => !snapshots[id].installed);
  return [...installed, ...notInstalled];
}
