import type { CapsLockMode } from "../../i18n/sections/settings/capsLock";
import type { CapsLockChange } from "./api";

export type CapsLockConfig = {
  mode: CapsLockMode;
  offAlert: boolean;
  badgeClick: boolean;
  passwordWarn: boolean;
  numLock: boolean;
};

export const CAPS_LOCK_MODES: readonly CapsLockMode[] = ["flash", "badge", "both"];

export const DEFAULT_CAPS_LOCK_CONFIG: CapsLockConfig = {
  mode: "both",
  offAlert: true,
  badgeClick: true,
  passwordWarn: true,
  numLock: false,
};

export function readCapsLockConfig(config: Readonly<Record<string, unknown>>): CapsLockConfig {
  const mode = CAPS_LOCK_MODES.find((candidate) => candidate === config.mode) ?? DEFAULT_CAPS_LOCK_CONFIG.mode;
  const offAlert = typeof config.offAlert === "boolean" ? config.offAlert : DEFAULT_CAPS_LOCK_CONFIG.offAlert;
  const badgeClick = typeof config.badgeClick === "boolean" ? config.badgeClick : DEFAULT_CAPS_LOCK_CONFIG.badgeClick;
  const passwordWarn = typeof config.passwordWarn === "boolean" ? config.passwordWarn : DEFAULT_CAPS_LOCK_CONFIG.passwordWarn;
  const numLock = typeof config.numLock === "boolean" ? config.numLock : DEFAULT_CAPS_LOCK_CONFIG.numLock;
  return { mode, offAlert, badgeClick, passwordWarn, numLock };
}

export function shouldFlash(change: CapsLockChange, config: CapsLockConfig): boolean {
  if (change.source !== "key" || config.mode === "badge") return false;
  return change.on || config.offAlert;
}

export function shouldFlashNumLock(change: CapsLockChange, config: CapsLockConfig, macOS = false): boolean {
  if (macOS || !config.numLock || change.source !== "key") return false;
  return change.on || config.offAlert;
}

export function showsBadge(on: boolean, config: CapsLockConfig): boolean {
  return on && config.mode !== "flash";
}
