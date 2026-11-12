import { readString, removeItem, writeJson } from "../../lib/storage.ts";

export const ONBOARDING_WELCOME_STORAGE_KEY = "fuyu-onboarding-welcome";

export type WelcomeKind = "hello" | "ready";

const WELCOME_MAX_AGE_MS = 5_000;

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

export const ONBOARDING_DEMO_STORAGE_KEY = "fuyu-onboarding-demo";

export const DEMO_RENEW_MS = 3_000;
const DEMO_GRACE_MS = 7_000;

export function renewIslandDemo(now = Date.now()) {
  writeJson(ONBOARDING_DEMO_STORAGE_KEY, { until: now + DEMO_GRACE_MS });
}

export function endIslandDemo() {
  removeItem(ONBOARDING_DEMO_STORAGE_KEY);
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
