import { useEffect, useState } from "react";
import { useLocale } from "../../i18n";
import { setTrackArt } from "../../lib/now-playing/trackArt";
import { getMediaSourceApp, type MediaSourceApp, type MediaState } from "./api";
import { sourceLabel } from "./sourceLabel.ts";

const UNKNOWN: MediaSourceApp = { icon: null, name: null };
const apps = new Map<string, Promise<MediaSourceApp>>();

function sourceApp(source: string): Promise<MediaSourceApp> {
  let request = apps.get(source);
  if (!request) {
    request = getMediaSourceApp(source).then((app) => ({ icon: app?.icon ?? null, name: app?.name ?? null }), () => UNKNOWN);
    apps.set(source, request);
  }
  return request;
}

export function usePublishTrackArt(state: MediaState, enabled: boolean) {
  const source = enabled ? state.sourceApp : null;
  const { locale } = useLocale();
  const [found, setFound] = useState<{ source: string; app: MediaSourceApp } | null>(null);

  useEffect(() => {
    if (!source) return;
    let cancelled = false;
    void sourceApp(source).then((app) => {
      if (!cancelled) setFound({ source, app });
    });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const app = source && found?.source === source ? found.app : UNKNOWN;
  const cover = enabled ? state.thumbnail : null;
  const label = enabled ? sourceLabel(state, app.name, locale) : null;

  useEffect(() => {
    setTrackArt(enabled ? { cover, sourceLabel: label, sourceIcon: app.icon } : null);
  }, [enabled, cover, label, app.icon]);

  useEffect(() => () => setTrackArt(null), []);
}
