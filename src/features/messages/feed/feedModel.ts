import type { ImNotificationItem, ImSourceId } from "../im-sources/imSourcesState.ts";
import type { MailMessage, MailSnapshot } from "../mail/api.ts";
import type { MessageSource } from "../messagePreview.ts";
import type { QQNotification } from "../qq-notifications/api.ts";
import type { ReminderItem } from "../wechat/api.ts";

export type FeedItem = {
  key: string;
  source: MessageSource;
  id: string;
  title: string;
  text: string;
  at: number;
  unread: number;
  otp: string | null;
  account: string | null;
  chat: string | null;
  plain: boolean;
  conversation: string;
  mail: MailMessage | null;
};

export type FeedText = {
  wechat: string;
  newReminder: string;
  plainReason: (reason: ReminderItem["reason"]) => string;
  flashBody: string;
  noSubject: string;
};

export type FeedInput = {
  qq: readonly QQNotification[] | null;
  wechat: { items: readonly ReminderItem[]; pending: boolean; lastAttentionAt: number | null } | null;
  mailboxes: readonly MailSnapshot[];
  im: Partial<Record<ImSourceId, readonly ImNotificationItem[]>>;
  handled: ReadonlySet<string>;
  findOtp: (text: string) => string | null;
  now: number;
  text: FeedText;
};

export const READ_MAIL_WINDOW_MS = 48 * 3_600_000;

export const feedKey = (source: MessageSource, id: string) => `${source}:${id}`;

function chatItem(input: FeedInput, source: MessageSource, id: string, title: string, text: string, at: number, unread: number | null | undefined, extra: Partial<FeedItem> = {}): FeedItem {
  const key = feedKey(source, id);
  const count = Math.max(1, unread ?? 1);
  return {
    key, source, id, title, text, at,
    unread: input.handled.has(key) ? 0 : count,
    otp: input.findOtp(`${title}\n${text}`),
    account: null, chat: null, plain: false,
    conversation: `${source}:${title}`,
    mail: null,
    ...extra,
  };
}

function wechatItems(input: FeedInput): FeedItem[] {
  const wechat = input.wechat;
  if (!wechat) return [];
  const items = wechat.items.map((item) => item.message
    ? chatItem(input, "wechat", String(item.at), item.message.contact, item.message.preview, item.at, item.message.unread ?? item.unread, { chat: item.message.chat })
    : chatItem(input, "wechat", String(item.at), input.text.wechat, item.unread ? `${input.text.newReminder}` : input.text.plainReason(item.reason), item.at, item.unread, { plain: true, conversation: "wechat:plain" }));
  if (items.length === 0 && wechat.pending) {
    const at = wechat.lastAttentionAt ?? input.now;
    items.push(chatItem(input, "wechat", `pending-${at}`, input.text.wechat, input.text.newReminder, at, 1, { plain: true, conversation: "wechat:plain" }));
  }
  return items;
}

function mailItems(input: FeedInput): FeedItem[] {
  const out: FeedItem[] = [];
  for (const box of input.mailboxes) {
    if (!box.email || !box.configured || !box.enabled) continue;
    for (const mail of box.items) {
      const at = mail.receivedAt ?? box.lastSyncedAt ?? 0;
      if (!mail.unread && input.now - at > READ_MAIL_WINDOW_MS) continue;
      const subject = mail.subject.trim() || input.text.noSubject;
      out.push({
        key: feedKey("qqMail", `${box.email}:${mail.id}`),
        source: "qqMail", id: mail.id, title: mail.sender, text: subject, at,
        unread: mail.unread ? 1 : 0,
        otp: input.findOtp(subject),
        account: box.email, chat: null, plain: false,
        conversation: `qqMail:${box.email}:${mail.sender}`,
        mail,
      });
    }
  }
  return out;
}

export function buildFeed(input: FeedInput): FeedItem[] {
  const items: FeedItem[] = [];
  for (const item of input.qq ?? []) items.push(chatItem(input, "qq", item.id, item.title, item.body, item.createdAt, item.unread));
  items.push(...wechatItems(input));
  items.push(...mailItems(input));
  for (const [source, list] of Object.entries(input.im) as [ImSourceId, readonly ImNotificationItem[]][]) {
    for (const item of list ?? []) {
      const plain = item.kind !== "toast";
      items.push(chatItem(input, source, item.id, item.title, plain && !item.body ? input.text.flashBody : item.body, item.createdAt, item.unread, { plain }));
    }
  }
  return items.sort((a, b) => b.at - a.at || a.key.localeCompare(b.key));
}

export type FeedBucket = "recent" | "today" | "yesterday" | "earlier";

export const RECENT_MS = 15 * 60_000;

export function bucketOf(at: number, now: number): FeedBucket {
  if (now - at < RECENT_MS) return "recent";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  if (at >= today.getTime()) return "today";
  if (at >= today.getTime() - 86_400_000) return "yesterday";
  return "earlier";
}

export function groupByBucket(items: readonly FeedItem[], now: number): { bucket: FeedBucket; items: FeedItem[] }[] {
  const groups: { bucket: FeedBucket; items: FeedItem[] }[] = [];
  for (const item of items) {
    const bucket = bucketOf(item.at, now);
    const last = groups[groups.length - 1];
    if (last?.bucket === bucket) last.items.push(item);
    else groups.push({ bucket, items: [item] });
  }
  return groups;
}

export type FeedConversation = { key: string; source: MessageSource; title: string; items: FeedItem[]; unread: number; at: number };

export function groupByConversation(items: readonly FeedItem[]): FeedConversation[] {
  const map = new Map<string, FeedConversation>();
  for (const item of items) {
    const found = map.get(item.conversation);
    if (found) {
      found.items.push(item);
      found.unread += item.unread;
      continue;
    }
    map.set(item.conversation, { key: item.conversation, source: item.source, title: item.title, items: [item], unread: item.unread, at: item.at });
  }
  return [...map.values()].sort((a, b) => b.at - a.at);
}

export type FeedRun = { key: string; item: FeedItem; lines: FeedItem[] };

export const RUN_GAP_MS = 10 * 60_000;

export function groupRuns(items: readonly FeedItem[]): FeedRun[] {
  const runs: FeedRun[] = [];
  for (const item of items) {
    const last = runs[runs.length - 1];
    const head = last?.lines[last.lines.length - 1];
    if (last && head && head.conversation === item.conversation && head.at - item.at <= RUN_GAP_MS) last.lines.push(item);
    else runs.push({ key: item.key, item, lines: [item] });
  }
  return runs;
}

export function unreadTotal(items: readonly FeedItem[], source?: MessageSource): number {
  return items.reduce((sum, item) => (source && item.source !== source ? sum : sum + (item.unread > 0 ? 1 : 0)), 0);
}

export function activityDots(items: readonly FeedItem[], now: number, spanMs: number): { key: string; source: MessageSource; ratio: number; title: string; at: number }[] {
  return items
    .filter((item) => now - item.at <= spanMs && item.at <= now)
    .map((item) => ({ key: item.key, source: item.source, ratio: 1 - (now - item.at) / spanMs, title: item.title, at: item.at }));
}

export function avatarTone(title: string, tones = 8): number {
  let sum = 0;
  for (const char of title) sum = (sum + (char.codePointAt(0) ?? 0)) % 9_973;
  return sum % tones;
}

export function avatarLetter(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "·";
  const first = [...trimmed][0];
  return /[a-z]/i.test(first) ? first.toUpperCase() : first;
}
