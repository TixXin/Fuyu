import type { ImSourceId } from "../im-sources/imSourcesState.ts";

export type ChatSource = "qq" | "wechat" | ImSourceId;

export type SourceCapability = "full" | "mentions" | "remind" | "count";

const WINDOWS_IM_CAPABILITY: Record<ImSourceId, SourceCapability> = {
  telegram: "remind",
  discord: "full",
  whatsapp: "full",
  tim: "remind",
  feishu: "full",
  dingtalk: "mentions",
  wecom: "remind",
};

export type SourceTone = "off" | "ok" | "busy" | "warn" | "problem";

export type ChatSourceState = { enabled: boolean; status: string; error?: string | null };

export function chatCapability(source: ChatSource, options: { mac: boolean; wechatExposeUi: boolean }): SourceCapability {
  if (options.mac) return "count";
  if (source === "wechat") return options.wechatExposeUi ? "full" : "remind";
  if (source === "qq") return "full";
  return WINDOWS_IM_CAPABILITY[source];
}

export function needsAccess({ enabled, status }: ChatSourceState): boolean {
  return enabled && (status === "permissionRequired" || status === "permissionDenied");
}

export function chatTone(state: ChatSourceState, mac: boolean): SourceTone {
  if (!state.enabled) return "off";
  if (state.error) return "problem";
  if (needsAccess(state)) return mac ? "warn" : "problem";
  if (state.status === "listening") return "ok";
  return state.status === "error" ? "problem" : "busy";
}

export type SourcesSummary = { on: number; problems: number; busy: number };

export function summarizeSources(
  chats: readonly ChatSourceState[],
  mail: { enabled: boolean; stale: number },
  mac: boolean,
): SourcesSummary {
  const tones = chats.map((chat) => chatTone(chat, mac));
  const waitingForAccess = tones.filter((tone) => tone === "warn").length;
  return {
    on: chats.filter((chat) => chat.enabled).length + (mail.enabled ? 1 : 0),
    problems: tones.filter((tone) => tone === "problem").length + Math.min(waitingForAccess, 1) + (mail.enabled ? mail.stale : 0),
    busy: tones.filter((tone) => tone === "busy").length,
  };
}
