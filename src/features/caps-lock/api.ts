import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export const CAPS_LOCK_EVENT = "caps-lock-changed";

export type ChangeSource = "key" | "wake";

export type CapsLockChange = { on: boolean; source: ChangeSource };

export function listenCapsLock(onChange: (change: CapsLockChange) => void) {
  return listen<CapsLockChange>(CAPS_LOCK_EVENT, (event) => onChange(event.payload));
}

export function getCapsLockState() {
  return invoke<boolean>("get_caps_lock_state");
}

export function turnOffCapsLock() {
  return invoke<boolean>("turn_off_caps_lock");
}
