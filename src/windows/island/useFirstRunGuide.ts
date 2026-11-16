import { useEffect, useState } from "react";
import { islandRanBefore } from "../../lib/settings/installState";
import { runIslandAction } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import { openFirstRunOnboardingWindow } from "../onboarding/api";
import { ONBOARDING_WELCOME_STORAGE_KEY, parseWelcome } from "../onboarding/storage";

const OPEN_DELAY_MS = 1_200;
const WELCOME_MS = 6_000;
const WELCOME_SOURCE = "fuyu.onboarding";

let opened = false;

export function useFirstRunGuide() {
  const t = useTranslation();
  const [firstRun] = useState(() => !islandRanBefore());
  const text = t.onboarding.greeting;
  const name = t.onboarding.islandName;

  useEffect(() => {
    if (!firstRun || opened) return;
    const timer = window.setTimeout(() => {
      opened = true;
      openFirstRunOnboardingWindow();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [firstRun]);

  useEffect(() => {
    const greet = (event: StorageEvent) => {
      if (event.key !== ONBOARDING_WELCOME_STORAGE_KEY) return;
      const kind = parseWelcome(event.newValue);
      if (!kind) return;
      runIslandAction("notify", {
        pluginId: WELCOME_SOURCE,
        pluginName: { "zh-CN": name, en: name },
        title: text[kind].title,
        body: text[kind].body,
        durationMs: WELCOME_MS,
        actions: [],
        layout: "card",
      });
    };
    window.addEventListener("storage", greet);
    return () => window.removeEventListener("storage", greet);
  }, [text, name]);
}
