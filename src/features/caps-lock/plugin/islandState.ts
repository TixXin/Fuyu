import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { CapsLockAlert } from "../useCapsLock";

export const CAPS_LOCK_ITEM = "caps-lock";
export const CAPS_LOCK_BADGE_HINT = "caps-lock.badge";
export const CAPS_LOCK_BADGE_WIDTH = 22;

export type CapsLockView = {
  expanded: boolean;
  on: boolean;
  alert: CapsLockAlert | null;
  badge: boolean;
  badgeClick: boolean;
};

export const capsLockState = createRunnerStore<CapsLockView>({ expanded: false, on: false, alert: null, badge: false, badgeClick: true });
