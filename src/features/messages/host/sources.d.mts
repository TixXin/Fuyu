import type {
  MessageArrivalNotice,
  MessageSourceId,
  MessageSourceStatus,
} from "@fuyu/plugin-services";

export type NormalizedArrivalNotice = Required<
  Pick<
    MessageArrivalNotice,
    "source" | "pluginId" | "title" | "body" | "receivedAt" | "durationMs" | "iconUrl" | "layout" | "controls" | "actions"
  >
>;

export type MessageSourceSpec = {
  id: MessageSourceId;
  label: { zh: string; en: string } | string;
  builtin?: boolean;
  pluginId?: string;
  enabled?: boolean;
  order?: number;
  status?: () => { enabled?: boolean; unreadCount?: number; pending?: boolean };
  clear?: () => void | Promise<void>;
  open?: () => void | Promise<void>;
};

export type MessageArrivalResult = { shown: boolean; receivedAt: number };

export type MessageSourceRegistry = {
  register(spec: MessageSourceSpec): () => void;
  sources(): { sources: readonly MessageSourceStatus[] };
  snapshot(): readonly MessageSourceStatus[];
  subscribe(listener: () => void): () => void;
  notify(notice: unknown): MessageArrivalResult | Promise<MessageArrivalResult>;
  clear(params?: unknown): Promise<{ ok: true }>;
  refresh(): void;
  resetForTest(): void;
};

export const BUILTIN_MESSAGE_SOURCES: readonly MessageSourceSpec[];
export function normalizeArrivalNotice(raw: unknown, now?: number): NormalizedArrivalNotice;
export function clearParamsOf(params: unknown): { source: string | undefined };
export function createMessageSourceRegistry(options?: {
  config?: Readonly<Record<string, unknown>>;
  onChange?: () => void;
  onArrive?: (notice: NormalizedArrivalNotice) => boolean | void | Promise<boolean>;
}): MessageSourceRegistry;
export function setMessageArrivalHandler(
  handler: ((notice: NormalizedArrivalNotice) => boolean | void) | null,
): void;
export function registerMessageSource(spec: MessageSourceSpec): () => void;
export function getMessageSources(): { sources: readonly MessageSourceStatus[] };
export function getMessageSourcesSnapshot(): readonly MessageSourceStatus[];
export function subscribeMessageSources(listener: () => void): () => void;
export function notifyMessageArrival(notice: unknown): { shown: boolean; receivedAt: number };
export function clearMessageSources(params?: unknown): Promise<{ ok: true }>;
export function refreshMessageSources(): void;
export function resetMessageSourcesForTest(): void;
