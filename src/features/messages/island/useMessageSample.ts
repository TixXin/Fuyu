import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useTranslation } from "../../../i18n";
import type { IslandNotice } from "../../../lib/island-notices/service";
import { listenMessageSampleRequested } from "../api";
import { OWNER } from "../plugin/owner.ts";

const SAMPLE_MS = 5_000;

export function useMessageSample(post: (notice: IslandNotice) => void) {
  const labels = useTranslation().messages;
  const show = useRef(() => {});
  show.current = () => post({ pluginId: OWNER, pluginName: null, title: labels.sampleTitle, body: labels.sampleBody, durationMs: SAMPLE_MS, actions: [] });

  useEffect(() => {
    if (!isTauri()) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void listenMessageSampleRequested(() => show.current())
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch((error) => console.error("Failed to listen for the sample message request", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
}
