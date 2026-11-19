import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "@fuyu/plugin-base";
import { mediaV1, messagesV1, type NowPlaying } from "@fuyu/plugin-services";
import { currentLocale } from "./locale.ts";
import {
  LAST_ONLY_WAIT_MS,
  METHODS,
  REREAD_MS,
  TOPICS,
  appAllowed,
  buildNotice,
  isHeard,
  normalizeConfig,
  pollDelay,
  readStoredConfig,
  rememberApp,
  trackKey,
  type NoticeConfig,
  type NoticeState,
} from "./model.ts";
import { COMMAND_TITLE, TEXT } from "./text.ts";

export const name = "@fuyu/now-playing";
export const inject = ["clients", "commands", "media/v1", "messages/v1"];

const CONFIG_FILE = "config.json";

type MediaEvents = { on(event: "changed", listener: () => void): unknown };

function readConfig(dir: string): NoticeConfig {
  const file = join(dir, CONFIG_FILE);
  if (!existsSync(file)) return readStoredConfig(null);
  try {
    return readStoredConfig(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    return readStoredConfig(null);
  }
}

function writeConfig(dir: string, config: NoticeConfig): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function apply(ctx: Context) {
  const media = ctx.services.get(mediaV1);
  const messages = ctx.services.get(messagesV1);

  let config = readConfig(ctx.dataDir);
  let current: NowPlaying | null = null;
  let note: string | null = null;
  let lastKey: string | null = null;
  let readFailed = false;
  let lastHeardAt = 0;
  let eventsSeen = false;
  let stopPoll: (() => Promise<void>) | null = null;
  let stopWait: (() => Promise<void>) | null = null;
  let stopReread: (() => Promise<void>) | null = null;

  const text = () => TEXT[currentLocale()];
  const snapshot = (): NoticeState => ({ config, current, note, updatedAt: Date.now() });
  const publish = () => ctx.clients.publish(TOPICS.state, snapshot());
  const save = () => writeConfig(ctx.dataDir, config);

  async function read(): Promise<NowPlaying | null> {
    try {
      const next = await media.nowPlaying();
      readFailed = false;
      current = next;
      const remembered = rememberApp(config, next.sourceApp);
      if (remembered) {
        config = remembered;
        save();
      }
      return next;
    } catch {
      readFailed = true;
      return null;
    }
  }

  async function show(track: NowPlaying | null): Promise<boolean | null> {
    const notice = buildNotice(track, config);
    if (!notice) return null;
    const answer = await messages.notify({ source: name, pluginId: name, ...notice });
    return answer.shown;
  }

  function cancelWait() {
    if (stopWait) void stopWait();
    stopWait = null;
  }

  function consider(track: NowPlaying | null) {
    const now = Date.now();
    if (track?.playing && !trackKey(track)) lastHeardAt = now;
    if (!track || !isHeard(track, lastHeardAt, now)) return;
    const key = trackKey(track);
    if (!key || key === lastKey) return;
    lastKey = key;
    if (!config.autoNotify || !appAllowed(track.sourceApp, config)) return;
    cancelWait();
    if (!config.lastOnly) {
      void show(track).catch(() => undefined);
      return;
    }
    stopWait = ctx.setTimeout(() => {
      stopWait = null;
      void show(track).catch(() => undefined);
    }, LAST_ONLY_WAIT_MS);
  }

  async function tick() {
    const before = trackKey(current);
    const wasPlaying = current?.playing;
    const next = await read();
    consider(next);
    if (trackKey(current) !== before || current?.playing !== wasPlaying) publish();
  }

  function schedulePoll() {
    if (stopPoll) void stopPoll();
    stopPoll = null;
    if (!config.autoNotify) return;
    stopPoll = ctx.setTimeout(() => {
      stopPoll = null;
      void tick().finally(schedulePoll);
    }, pollDelay(readFailed, eventsSeen));
  }

  function scheduleReread() {
    if (stopReread) void stopReread();
    stopReread = ctx.setTimeout(() => {
      stopReread = null;
      void tick();
    }, REREAD_MS);
  }

  async function prime() {
    const first = await read();
    if (first?.playing && !trackKey(first)) lastHeardAt = Date.now();
    lastKey = first && isHeard(first, lastHeardAt, Date.now()) ? trackKey(first) ?? lastKey : lastKey;
    publish();
  }

  try {
    (media as unknown as MediaEvents).on("changed", () => {
      eventsSeen = true;
      schedulePoll();
      void tick().then(() => {
        if (current?.playing && !trackKey(current)) scheduleReread();
      });
    });
  } catch {
    eventsSeen = false;
  }

  void prime().finally(schedulePoll);

  ctx.clients.handle(METHODS.getState, async () => {
    await read();
    return snapshot();
  });

  ctx.clients.handle(METHODS.setConfig, async (patch?: Partial<NoticeConfig>) => {
    const wasOn = config.autoNotify;
    const { seenApps } = config;
    config = { ...normalizeConfig(patch, config), seenApps };
    note = null;
    save();
    if (!config.autoNotify) cancelWait();
    if (config.autoNotify && !wasOn) await prime();
    schedulePoll();
    publish();
    return snapshot();
  });

  const showNow = async () => {
    const latest = await read();
    const shown = await show(latest);
    note = shown === null ? text().nothingPlaying : shown ? text().shown : text().notShown;
    publish();
    return snapshot();
  };

  ctx.clients.handle(METHODS.showNow, showNow);
  ctx.commands.register("show", showNow, { title: COMMAND_TITLE });
}
