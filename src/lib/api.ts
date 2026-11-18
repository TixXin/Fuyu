import { invoke, isTauri } from "@tauri-apps/api/core";

export type PlatformFeature = "clipboard" | "screenshot" | "translation" | "music" | "qq" | "wechat" | "agentConnect" | "agentRemote";

export type PlatformSupport = { os: "windows" | "macos"; unsupported: PlatformFeature[]; devBuild?: boolean };

export function readPlatformSupport() {
  return invoke<PlatformSupport>("get_platform_support");
}

export function getUserIdleSeconds() {
  return invoke<number | null>("get_user_idle_seconds");
}

export function isSessionLocked() {
  return invoke<boolean>("is_session_locked");
}

export async function copyMessageText(text: string): Promise<void> {
  if (!text) return;
  if (isTauri()) {
    await invoke<void>("copy_message_text", { text });
    return;
  }
  await navigator.clipboard.writeText(text);
}
