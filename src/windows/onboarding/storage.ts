import { readJson, readString, removeItem, writeJson } from "../../lib/storage.ts";
import type { IslandPage } from "../island/types";

export const ONBOARDING_WELCOME_STORAGE_KEY = "fuyu-onboarding-welcome";
export const ONBOARDING_DEMO_STORAGE_KEY = "fuyu-onboarding-demo";
export const ONBOARDING_DIRECTOR_STORAGE_KEY = "fuyu-onboarding-director";
export const ONBOARDING_MODE_STORAGE_KEY = "fuyu-onboarding-mode";
export const ONBOARDING_GUIDE_VERSION_STORAGE_KEY = "fuyu-onboarding-guide-version";

export type WelcomeKind = "hello" | "ready";
export type OnboardingLaunchMode = "firstRun" | "whatsNew";

export type DirectorCommand =
  | { action: "expand"; page?: IslandPage; requestedAt: number; nonce: number }
  | { action: "collapse"; requestedAt: number; nonce: number }
  | { action: "tuck"; requestedAt: number; nonce: number }
  | { action: "reveal"; requestedAt: number; nonce: number }
  | { action: "notify"; title: string; body: string; requestedAt: number; nonce: number };

let directorNonce = 0;

const WELCOME_MAX_AGE_MS = 5_000;
const DIRECTOR_MAX_AGE_MS = 5_000;
const LAUNCH_MODE_MAX_AGE_MS = 15_000;

export const DEMO_RENEW_MS = 3_000;
const DEMO_GRACE_MS = 7_000;

export function requestIslandWelcome(kind: WelcomeKind) {
  writeJson(ONBOARDING_WELCOME_STORAGE_KEY, { kind, requestedAt: Date.now() });
}

export function parseWelcome(stored: string | null, now = Date.now()): WelcomeKind | null {
  if (stored === null) return null;
  try {
    const request = JSON.parse(stored) as { kind?: unknown; requestedAt?: unknown };
    if (typeof request.requestedAt !== "number" || now - request.requestedAt >= WELCOME_MAX_AGE_MS) return null;
    return request.kind === "hello" ? "hello" : "ready";
  } catch {
    return null;
  }
}

export function sendIslandDirectorCommand(
  command:
    | { action: "expand"; page?: IslandPage }
    | { action: "collapse" }
    | { action: "tuck" }
    | { action: "reveal" }
    | { action: "notify"; title: string; body: string },
) {
  directorNonce += 1;
  writeJson(ONBOARDING_DIRECTOR_STORAGE_KEY, { ...command, requestedAt: Date.now(), nonce: directorNonce });
}

export function parseDirectorCommand(stored: string | null, now = Date.now()): DirectorCommand | null {
  if (stored === null) return null;
  try {
    const raw = JSON.parse(stored) as Record<string, unknown>;
    if (typeof raw.requestedAt !== "number" || now - raw.requestedAt >= DIRECTOR_MAX_AGE_MS) return null;
    const nonce = typeof raw.nonce === "number" ? raw.nonce : 0;
    if (raw.action === "collapse" || raw.action === "tuck" || raw.action === "reveal") {
      return { action: raw.action, requestedAt: raw.requestedAt, nonce };
    }
    if (raw.action === "expand") {
      const page = typeof raw.page === "string" && raw.page.length > 0 ? (raw.page as IslandPage) : undefined;
      return { action: "expand", page, requestedAt: raw.requestedAt, nonce };
    }
    if (raw.action === "notify" && typeof raw.title === "string" && typeof raw.body === "string") {
      return { action: "notify", title: raw.title, body: raw.body, requestedAt: raw.requestedAt, nonce };
    }
    return null;
  } catch {
    return null;
  }
}

export function setOnboardingLaunchMode(mode: OnboardingLaunchMode, fromVersion?: string | null) {
  writeJson(ONBOARDING_MODE_STORAGE_KEY, { mode, fromVersion: fromVersion ?? null, requestedAt: Date.now() });
}

export function consumeOnboardingLaunchMode(now = Date.now()): { mode: OnboardingLaunchMode; fromVersion: string | null } {
  const raw = readJson(ONBOARDING_MODE_STORAGE_KEY) as { mode?: unknown; fromVersion?: unknown; requestedAt?: unknown } | null;
  removeItem(ONBOARDING_MODE_STORAGE_KEY);
  if (!raw || typeof raw.requestedAt !== "number" || now - raw.requestedAt >= LAUNCH_MODE_MAX_AGE_MS) {
    return { mode: "firstRun", fromVersion: null };
  }
  return {
    mode: raw.mode === "whatsNew" ? "whatsNew" : "firstRun",
    fromVersion: typeof raw.fromVersion === "string" ? raw.fromVersion : null,
  };
}

export function readGuideSeenVersion(): string | null {
  const raw = readJson(ONBOARDING_GUIDE_VERSION_STORAGE_KEY) as { seenVersion?: unknown } | null;
  return raw && typeof raw.seenVersion === "string" && raw.seenVersion.trim() ? raw.seenVersion.trim() : null;
}

export function writeGuideSeenVersion(version: string) {
  if (!version.trim()) return;
  writeJson(ONBOARDING_GUIDE_VERSION_STORAGE_KEY, { seenVersion: version.trim() });
}

const GUIDE_VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/;

export function isNewerGuideVersion(current: string, seen: string): boolean {
  const a = current.trim().match(GUIDE_VERSION);
  const b = seen.trim().match(GUIDE_VERSION);
  if (!a || !b) return false;
  const core = Number(a[1]) - Number(b[1]) || Number(a[2]) - Number(b[2]) || Number(a[3]) - Number(b[3]);
  if (core !== 0) return core > 0;
  if (a[4] === b[4]) return false;
  if (a[4] === undefined) return true;
  if (b[4] === undefined) return false;
  return Number(a[4]) > Number(b[4]);
}

export function renewIslandDemo(now = Date.now()) {
  writeJson(ONBOARDING_DEMO_STORAGE_KEY, { until: now + DEMO_GRACE_MS });
}

export function endIslandDemo() {
  removeItem(ONBOARDING_DEMO_STORAGE_KEY);
  removeItem(ONBOARDING_DIRECTOR_STORAGE_KEY);
}

export function islandDemoUntil(stored = readString(ONBOARDING_DEMO_STORAGE_KEY)): number {
  if (stored === null) return 0;
  try {
    const value = (JSON.parse(stored) as { until?: unknown }).until;
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
