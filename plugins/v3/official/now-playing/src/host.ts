import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { defineService } from "@fuyu/plugin-base/services";
import { mediaV1, messagesV1, type NowPlaying } from "@fuyu/plugin-services";
import { METHODS, TEXT, TOPICS, type Locale, type NowPlayingConfig, type NowPlayingState } from "./types.ts";

export const name = "@fuyu/now-playing";
export const inject = ["clients", "media/v1", "messages/v1"];

const POLL_MS = 2500;
const CONFIG_FILE = "config.json";

const mediaEventsDef = defineService<{ nowPlaying(): NowPlaying }, { changed: Partial<NowPlaying> }>("media/v1", {
  methods: { nowPlaying: true },
  events: { changed: true },
});

function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : "zh-CN";
}

function readConfig(dir: string): NowPlayingConfig {
  try {
    const file = join(dir, CONFIG_FILE);
    if (!existsSync(file)) return { autoNotify: false, locale: "zh-CN" };
    const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<NowPlayingConfig>;
    return {
      autoNotify: raw.autoNotify === true,
      locale: normalizeLocale(raw.locale),
    };
  } catch {
    return { autoNotify: false, locale: "zh-CN" };
  }
}

function writeConfig(dir: string, config: NowPlayingConfig): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function trackKey(track: Partial<NowPlaying> | null | undefined): string | null {
  const title = typeof track?.title === "string" ? track.title.trim() : "";
  if (!title) return null;
  const artist = typeof track?.artist === "string" ? track.artist.trim() : "";
  return `${title}\n${artist}`;
}

export function apply(ctx: Context) {
  const media = ctx.services.get(mediaV1);
  const mediaEvents = ctx.services.get(mediaEventsDef);
  const messages = ctx.services.get(messagesV1);

  let config = readConfig(ctx.dataDir);
  let current: NowPlaying | null = null;
  let note: string | null = null;
  let lastNotifiedKey: string | null = null;
  let stopPolling: (() => Promise<void>) | null = null;

  const snapshot = (): NowPlayingState => ({
    config,
    current,
    note,
    updatedAt: Date.now(),
  });

  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());

  async function sendNotice(track: Partial<NowPlaying> | null | undefined, manual: boolean): Promise<boolean> {
    const title = typeof track?.title === "string" ? track.title.trim() : "";
    if (!title) {
      if (manual) {
        note = TEXT[config.locale].nothingPlaying;
        publish();
      }
      return false;
    }
    const artist = typeof track?.artist === "string" ? track.artist.trim() : "";
    await messages.notify({
      source: name,
      pluginId: name,
      title,
      body: artist,
      durationMs: 6000,
      layout: "inline",
      controls: "media",
    });
    lastNotifiedKey = trackKey(track);
    if (manual) {
      note = TEXT[config.locale].shownOnIsland;
      publish();
    }
    return true;
  }

  async function refreshCurrent(checkAutoNotify: boolean): Promise<NowPlaying | null> {
    try {
      const next = await media.nowPlaying();
      current = next;
      if (checkAutoNotify && config.autoNotify && next.playing) {
        const key = trackKey(next);
        if (key && key !== lastNotifiedKey) {
          await sendNotice(next, false);
        }
      } else if (!next.playing || !trackKey(next)) {
        lastNotifiedKey = null;
      }
      publish();
      return next;
    } catch {
      return null;
    }
  }

  function syncPolling() {
    if (config.autoNotify && !stopPolling) {
      stopPolling = ctx.setInterval(() => {
        void refreshCurrent(true);
      }, POLL_MS);
    } else if (!config.autoNotify && stopPolling) {
      void stopPolling();
      stopPolling = null;
    }
  }

  mediaEvents.on("changed", (payload) => {
    if (payload && typeof payload.title === "string" && payload.title.trim() !== "") {
      const merged: NowPlaying = {
        available: payload.available ?? true,
        playing: payload.playing ?? true,
        audible: payload.audible ?? true,
        title: payload.title,
        artist: payload.artist ?? null,
        album: payload.album ?? null,
        sourceApp: payload.sourceApp ?? null,
        positionMs: payload.positionMs ?? 0,
        durationMs: payload.durationMs ?? 0,
        canSeek: payload.canSeek ?? false,
        canNext: payload.canNext ?? false,
        canPrevious: payload.canPrevious ?? false,
        updatedAt: payload.updatedAt ?? Date.now(),
      };
      current = merged;
      const key = trackKey(merged);
      if (config.autoNotify && merged.playing && key && key !== lastNotifiedKey) {
        void sendNotice(merged, false);
      }
      publish();
      return;
    }
    void refreshCurrent(true);
  });

  syncPolling();
  void refreshCurrent(false).then((first) => {
    if (first?.playing) {
      lastNotifiedKey = trackKey(first);
    }
  });

  ctx.clients.handle(METHODS.getState, async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      writeConfig(ctx.dataDir, config);
    }
    await refreshCurrent(false);
    return snapshot();
  });

  ctx.clients.handle(METHODS.setConfig, async (params?: Partial<NowPlayingConfig>) => {
    config = {
      autoNotify: typeof params?.autoNotify === "boolean" ? params.autoNotify : config.autoNotify,
      locale: params?.locale ? normalizeLocale(params.locale) : config.locale,
    };
    note = null;
    writeConfig(ctx.dataDir, config);
    syncPolling();
    if (config.autoNotify) {
      const latest = await refreshCurrent(false);
      lastNotifiedKey = latest?.playing ? trackKey(latest) : null;
    }
    publish();
    return snapshot();
  });

  const handleShowNow = async (params?: { locale?: Locale }) => {
    if (params?.locale && params.locale !== config.locale) {
      config = { ...config, locale: normalizeLocale(params.locale) };
      writeConfig(ctx.dataDir, config);
    }
    const latest = await refreshCurrent(false);
    await sendNotice(latest, true);
    return snapshot();
  };

  ctx.clients.handle(METHODS.showNow, handleShowNow);
  ctx.clients.handle(METHODS.show, handleShowNow);
}
