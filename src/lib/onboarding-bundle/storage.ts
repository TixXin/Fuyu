import { readString, removeItem, writeJson } from "../storage.ts";
import { parseRecommendedBundle, type RecommendedBundle } from "./recommend.ts";

export const ONBOARDING_BUNDLE_STORAGE_KEY = "fuyu-onboarding-bundle";

export function storedOnboardingBundle(): string | null {
  return readString(ONBOARDING_BUNDLE_STORAGE_KEY);
}

export function parseOnboardingBundle(stored: string | null): RecommendedBundle | null {
  if (stored === null) return null;
  try {
    return parseRecommendedBundle(JSON.parse(stored));
  } catch {
    return null;
  }
}

export function saveOnboardingBundle(bundle: RecommendedBundle | null) {
  if (bundle) writeJson(ONBOARDING_BUNDLE_STORAGE_KEY, bundle);
  else removeItem(ONBOARDING_BUNDLE_STORAGE_KEY);
}
