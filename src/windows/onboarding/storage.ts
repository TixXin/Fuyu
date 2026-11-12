import { writeJson } from "../../lib/storage.ts";

// Guide -> island: the guide just flew into the island, which greets the user for a moment.
// The time makes every request a change that fires a storage event, and lets an old one be ignored.
export const ONBOARDING_WELCOME_STORAGE_KEY = "fuyu-onboarding-welcome";

const WELCOME_MAX_AGE_MS = 5_000;

export function requestIslandWelcome() {
  writeJson(ONBOARDING_WELCOME_STORAGE_KEY, { requestedAt: Date.now() });
}

/** Whether a stored welcome request is fresh and well formed. */
export function isFreshWelcome(stored: string | null, now = Date.now()) {
  if (stored === null) return false;
  try {
    const request = JSON.parse(stored) as { requestedAt?: unknown };
    return typeof request.requestedAt === "number" && now - request.requestedAt < WELCOME_MAX_AGE_MS;
  } catch {
    return false;
  }
}
