import { useEffect, useMemo, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { IslandSettings } from "../../../lib/settings/types";
import { karaokeLook } from "../lyrics/lyricsSettings";
import type { PlayingLyrics } from "../lyrics/usePlayingLyrics";
import type { MediaCommand, MediaState } from "../api";
import {
  currentWindowLabel,
  listenTaskbarLyricsRequests,
  sendTaskbarLyricsFeed,
  setTaskbarLyricsOpen,
  type TaskbarLyricsFeed,
  type TaskbarLyricsRequest,
} from "./api";

const INK = "var(--taskbar-lyrics-ink)";

type FeedSource = {
  settings: IslandSettings;
  mediaState: MediaState;
  lyrics: PlayingLyrics | undefined;
  runMediaCommand: (command: MediaCommand) => Promise<void> | void;
  openMusic: () => void;
};

const COMMANDS: Partial<Record<TaskbarLyricsRequest, MediaCommand>> = {
  previous: "media_previous",
  "play-pause": "media_play_pause",
  next: "media_next",
};

export function taskbarLyricsWanted(settings: IslandSettings): boolean {
  return settings.musicEnabled && settings.lyricsTaskbar && isTauri() && currentWindowLabel() === "main";
}

export function useTaskbarLyricsFeed({ settings, mediaState, lyrics, runMediaCommand, openMusic }: FeedSource) {
  const wanted = taskbarLyricsWanted(settings);
  const lines = lyrics?.lines ?? null;
  const offsetMs = lyrics?.offsetMs ?? 0;
  const look = useMemo(() => karaokeLook(settings, INK), [settings]);
  const even = settings.lyricsKaraokeFallback === "line";
  const karaokeOn = settings.lyricsKaraoke;
  const content = settings.lyricsTaskbarContent;
  const idle = settings.lyricsTaskbarIdle;
  const feed: TaskbarLyricsFeed = useMemo(
    () => ({ state: mediaState, lines, offsetMs, karaoke: karaokeOn ? { even, look } : null, content, idle }),
    [mediaState, lines, offsetMs, karaokeOn, even, look, content, idle],
  );
  const latest = useRef({ feed, runMediaCommand, openMusic });
  latest.current = { feed, runMediaCommand, openMusic };

  useEffect(() => {
    if (!wanted) return;
    void setTaskbarLyricsOpen(true).catch((error) => console.error("Failed to open the taskbar lyrics", error));
    return () => {
      void setTaskbarLyricsOpen(false).catch((error) => console.error("Failed to close the taskbar lyrics", error));
    };
  }, [wanted]);

  useEffect(() => {
    if (!wanted) return;
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenTaskbarLyricsRequests((request) => {
      const { feed: current, runMediaCommand: run, openMusic: open } = latest.current;
      const command = COMMANDS[request];
      if (command) void run(command);
      else if (request === "open") open();
      else void sendTaskbarLyricsFeed(current);
    })
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error) => console.error("Failed to listen for the taskbar lyrics", error));
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, [wanted]);

  useEffect(() => {
    if (wanted) void sendTaskbarLyricsFeed(feed).catch(() => undefined);
  }, [wanted, feed]);
}
