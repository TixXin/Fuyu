import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Presence } from "./breakReminders";

export const FOREGROUND_FULLSCREEN_CHANGED_EVENT = "foreground-fullscreen-changed";

type ForegroundFullscreen = { active: boolean; onIslandMonitor: boolean };

export async function readPresence(): Promise<Presence> {
  const [idleSeconds, locked] = await Promise.all([
    invoke<number | null>("get_user_idle_seconds"),
    invoke<boolean>("is_session_locked"),
  ]);
  return { idleSeconds, locked };
}

export async function readFullscreen(): Promise<boolean> {
  return (await invoke<ForegroundFullscreen>("get_foreground_fullscreen")).active;
}

export function listenFullscreen(handler: (active: boolean) => void): Promise<UnlistenFn> {
  return listen<ForegroundFullscreen>(FOREGROUND_FULLSCREEN_CHANGED_EVENT, ({ payload }) => handler(payload.active));
}
