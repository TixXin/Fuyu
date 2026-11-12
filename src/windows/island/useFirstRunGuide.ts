import { useEffect, useState } from "react";
import { islandRanBefore } from "../../features/appearance/installState";
import type { PluginNotificationsController } from "../../features/plugins/usePluginNotifications";
import { useTranslation } from "../../i18n";
import { openOnboardingWindow } from "../onboarding/api";
import { ONBOARDING_WELCOME_STORAGE_KEY, parseWelcome } from "../onboarding/storage";

/** Lets the island show on its own for a moment before the guide opens over the screen. */
const OPEN_DELAY_MS = 1_200;
/** How long a greeting stays in the island's message panel. */
const WELCOME_MS = 6_000;
/** Not a plugin: the island's own messages arrive the way a plugin's island.notify does. */
const WELCOME_SOURCE = "fuyu.onboarding";

// StrictMode runs effects twice; the guide opens once per start.
let opened = false;

/**
 * Opens the first-run guide on a new install, and greets the user in the island's message panel
 * when the guide asks (hello as it opens, ready as it ends). Islands that ran before (their
 * settings are saved, including those copied over from before the rename) never see the guide;
 * it stays one click away on Settings → About. Must be called during the island's first render,
 * before its effects save the settings.
 */
export function useFirstRunGuide(notifications: PluginNotificationsController) {
  const t = useTranslation();
  const [firstRun] = useState(() => !islandRanBefore());
  const { post } = notifications;
  const text = t.onboarding.greeting;
  const name = t.onboarding.islandName;

  useEffect(() => {
    if (!firstRun || opened) return;
    const timer = window.setTimeout(() => {
      opened = true;
      openOnboardingWindow();
    }, OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [firstRun]);

  useEffect(() => {
    const greet = (event: StorageEvent) => {
      if (event.key !== ONBOARDING_WELCOME_STORAGE_KEY) return;
      const kind = parseWelcome(event.newValue);
      if (!kind) return;
      post({
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
  }, [post, text, name]);
}
