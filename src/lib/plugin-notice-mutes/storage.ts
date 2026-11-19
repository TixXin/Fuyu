import { readJson, writeJson } from "../storage.ts";
import { normalizeNoticeIds, withNoticeMuted, withNoticeSender } from "./mutes.ts";

export const PLUGIN_NOTICE_MUTES_KEY = "fuyu-plugin-notice-mutes";
export const PLUGIN_NOTICE_SENDERS_KEY = "fuyu-plugin-notice-senders";

export function loadNoticeMutes(): string[] {
  return normalizeNoticeIds(readJson(PLUGIN_NOTICE_MUTES_KEY));
}

export function saveNoticeMuted(id: string, muted: boolean): string[] {
  const next = withNoticeMuted(loadNoticeMutes(), id, muted);
  writeJson(PLUGIN_NOTICE_MUTES_KEY, next);
  return next;
}

export function isPluginNoticeMuted(id: string): boolean {
  return loadNoticeMutes().includes(id);
}

export function loadNoticeSenders(): string[] {
  return normalizeNoticeIds(readJson(PLUGIN_NOTICE_SENDERS_KEY));
}

export function rememberNoticeSender(id: string): void {
  const next = withNoticeSender(loadNoticeSenders(), id);
  if (next) writeJson(PLUGIN_NOTICE_SENDERS_KEY, next);
}
