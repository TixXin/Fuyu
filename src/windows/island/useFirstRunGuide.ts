import { useEffect, useState } from "react";
import { islandRanBefore } from "../../lib/settings/installState";
import { runIslandAction } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import { getGuideAppVersion, openFirstRunOnboardingWindow, openWhatsNewOnboardingWindow } from "../onboarding/api";
import {
  ONBOARDING_DIRECTOR_STORAGE_KEY,
  ONBOARDING_WELCOME_STORAGE_KEY,
  isNewerGuideVersion,
  parseDirectorCommand,
  parseWelcome,
  readGuideSeenVersion,
  writeGuideSeenVersion,
} from "../onboarding/storage";
import type { IslandPage } from "./types";

const OPEN_DELAY_MS = 1_200;
const WELCOME_MS = 6_000;
const DIRECTOR_NOTIFY_MS = 3_200;
const WELCOME_SOURCE = "fuyu.onboarding";

let opened = false;

export type IslandDirectorHandlers = {
  openIslandPage: (page: IslandPage) => void;
  collapseIsland: () => void;
  tuckIsland: () => void;
  revealIsland: () => void;
};

export function useFirstRunGuide(director?: IslandDirectorHandlers) {
  const t = useTranslation();
  const [firstRun] = useState(() => !islandRanBefore());
  const text = t.onboarding.greeting;
  const name = t.onboarding.islandName;

  useEffect(() => {
    if (opened) return;
    if (firstRun) {
      const timer = window.setTimeout(() => {
        opened = true;
        openFirstRunOnboardingWindow();
      }, OPEN_DELAY_MS);
      return () => window.clearTimeout(timer);
    }
    let cancelled = false;
    let timer = 0;
    void getGuideAppVersion()
      .then((version) => {
        if (cancelled || opened) return;
        const seen = readGuideSeenVersion();
        if (!seen) {
          writeGuideSeenVersion(version);
          return;
        }
        if (!isNewerGuideVersion(version, seen)) return;
        timer = window.setTimeout(() => {
          if (cancelled || opened) return;
          opened = true;
          openWhatsNewOnboardingWindow(seen);
        }, OPEN_DELAY_MS);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [firstRun]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === ONBOARDING_WELCOME_STORAGE_KEY) {
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
        return;
      }
      if (event.key === ONBOARDING_DIRECTOR_STORAGE_KEY && director) {
        const cmd = parseDirectorCommand(event.newValue);
        if (!cmd) return;
        if (cmd.action === "expand") director.openIslandPage(cmd.page ?? "fuyu");
        else if (cmd.action === "collapse") director.collapseIsland();
        else if (cmd.action === "tuck") director.tuckIsland();
        else if (cmd.action === "reveal") director.revealIsland();
        else if (cmd.action === "notify") {
          runIslandAction("notify", {
            pluginId: WELCOME_SOURCE,
            pluginName: { "zh-CN": name, en: name },
            title: cmd.title,
            body: cmd.body,
            durationMs: DIRECTOR_NOTIFY_MS,
            actions: [],
            layout: "card",
          });
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [text, name, director]);
}
