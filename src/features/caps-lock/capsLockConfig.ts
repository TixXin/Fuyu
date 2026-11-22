import type { CapsLockMode } from "../../i18n/sections/settings/capsLock";
import type { CapsLockChange } from "./api";

export type CapsLockConfig = { mode: CapsLockMode; offAlert: boolean; badgeClick: boolean };

export const CAPS_LOCK_MODES: readonly CapsLockMode[] = ["flash", "badge", "both"];

export const DEFAULT_CAPS_LOCK_CONFIG: CapsLockConfig = { mode: "both", offAlert: true, badgeClick: true };

export function readCapsLockConfig(config: Readonly<Record<string, unknown>>): CapsLockConfig {
  const mode = CAPS_LOCK_MODES.find((candidate) => candidate === config.mode) ?? DEFAULT_CAPS_LOCK_CONFIG.mode;
  const offAlert = typeof config.offAlert === "boolean" ? config.offAlert : DEFAULT_CAPS_LOCK_CONFIG.offAlert;
  const badgeClick = typeof config.badgeClick === "boolean" ? config.badgeClick : DEFAULT_CAPS_LOCK_CONFIG.badgeClick;
  return { mode, offAlert, badgeClick };
}

export function shouldFlash(change: CapsLockChange, config: CapsLockConfig): boolean {
  if (change.source !== "key" || config.mode === "badge") return false;
  return change.on || config.offAlert;
}

export function showsBadge(on: boolean, config: CapsLockConfig): boolean {
  return on && config.mode !== "flash";
}
