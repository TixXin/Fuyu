import type { MessageSource } from "../messagePreview";

export type UnreadRow = { source: MessageSource; key: "qq" | "wechat" | "mail" | "other"; count: number | null };

export type UnreadCounts = { qq: number; wechat: boolean; mail: number; other: number; pendingIm: MessageSource | null };

export function unreadRows({ qq, wechat, mail, other, pendingIm }: UnreadCounts): { rows: UnreadRow[]; total: number } {
  const rows: UnreadRow[] = [];
  if (qq > 0) rows.push({ source: "qq", key: "qq", count: qq });
  if (wechat) rows.push({ source: "wechat", key: "wechat", count: null });
  if (mail > 0) rows.push({ source: "qqMail", key: "mail", count: mail });
  if (pendingIm && other > 0) rows.push({ source: pendingIm, key: "other", count: other });
  return { rows, total: rows.reduce((sum, row) => sum + (row.count ?? 0), 0) };
}
