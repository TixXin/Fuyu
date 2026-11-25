import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";

export const CAPS_LOCK_EVENT = "caps-lock-changed";
export const NUM_LOCK_EVENT = "num-lock-changed";
export const PASSWORD_FIELD_EVENT = "caps-lock-password-field-changed";
export const CAPS_LOCK_DEMO_EVENT = "caps-lock-demo";
export const CAPS_LOCK_DEMO_KEY = "fuyu-caps-lock-demo";
const DEMO_MAX_AGE_MS = 5000;

export type ChangeSource = "key" | "wake";

export type CapsLockChange = { on: boolean; source: ChangeSource };

export function listenCapsLock(onChange: (change: CapsLockChange) => void) {
  return listen<CapsLockChange>(CAPS_LOCK_EVENT, (event) => onChange(event.payload));
}

export function listenNumLock(onChange: (change: CapsLockChange) => void) {
  return listen<CapsLockChange>(NUM_LOCK_EVENT, (event) => onChange(event.payload));
}

export function listenCapsLockPasswordField(onChange: (focused: boolean) => void) {
  return listen<boolean>(PASSWORD_FIELD_EVENT, (event) => onChange(Boolean(event.payload)));
}

export function listenCapsLockDemo(onDemo: () => void) {
  return listen(CAPS_LOCK_DEMO_EVENT, () => onDemo());
}

export function triggerCapsLockDemo() {
  try {
    localStorage.setItem(CAPS_LOCK_DEMO_KEY, String(Date.now()));
  } catch {
  }
  return emitTo("main", CAPS_LOCK_DEMO_EVENT, {});
}

export function consumeCapsLockDemo(now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(CAPS_LOCK_DEMO_KEY);
    if (!raw) return false;
    localStorage.removeItem(CAPS_LOCK_DEMO_KEY);
    const at = Number(raw);
    return Number.isFinite(at) && now - at <= DEMO_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function getCapsLockState() {
  return invoke<boolean>("get_caps_lock_state");
}

export function turnOffCapsLock() {
  return invoke<boolean>("turn_off_caps_lock");
}
