import { useMemo, useSyncExternalStore } from "react";
import type { RecommendedBundle } from "../../lib/onboarding-bundle/recommend";
import { ONBOARDING_BUNDLE_STORAGE_KEY, parseOnboardingBundle, storedOnboardingBundle } from "../../lib/onboarding-bundle/storage";

function subscribe(notify: () => void) {
  const changed = (event: StorageEvent) => {
    if (event.key === ONBOARDING_BUNDLE_STORAGE_KEY || event.key === null) notify();
  };
  window.addEventListener("storage", changed);
  return () => window.removeEventListener("storage", changed);
}

export function useRecommendedBundle(): RecommendedBundle | null {
  const stored = useSyncExternalStore(subscribe, storedOnboardingBundle, storedOnboardingBundle);
  return useMemo(() => parseOnboardingBundle(stored), [stored]);
}
