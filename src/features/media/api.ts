import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type MediaPlaybackStatus = "unavailable" | "playing" | "paused";

export type MediaRepeatMode = "none" | "track" | "list" | "unknown";

export type MediaSessionInfo = {
  id: string;
  label: string;
  playing: boolean;
};

export type CustomMediaPlayer = {
  id: string;
  label: string;
};

export type MediaState = {
  available: boolean;
  audioActive: boolean;
  audioPeak: number;
  playbackStatus: MediaPlaybackStatus;
  title: string | null;
  artist: string | null;
  album: string | null;
  thumbnail: string | null;
  trackId?: string | null;
  positionMs: number;
  durationMs: number;
  positionEstimate?: "timed" | "unsure";
  canSeek: boolean;
  canNext: boolean;
  canPrevious: boolean;
  shuffleActive: boolean | null;
  canShuffle: boolean;
  repeatMode: MediaRepeatMode;
  canRepeat: boolean;
  volume: number;
  sourceApp: string | null;
  activeSessionId: string | null;
  sessions: MediaSessionInfo[];
  updatedAt: number;
};

export type AudioLevel = {
  active: boolean;
  peak: number;
  updatedAt: number;
};

export type MediaCommand = "media_play_pause" | "media_next" | "media_previous";

export function getMediaState(target: string | undefined) {
  return invoke<MediaState>("get_media_state", { target });
}

export function sendMediaCommand(command: MediaCommand, target: string | undefined) {
  return invoke<MediaState>(command, { target });
}

export function seekMedia(positionMs: number, target: string | undefined) {
  return invoke<MediaState>("media_seek", { positionMs, target });
}

export function getAudioLevel() {
  return invoke<AudioLevel>("get_audio_level");
}

export function getCustomMediaPlayers() {
  return invoke<CustomMediaPlayer[]>("get_custom_media_players");
}

export function addCustomMediaPlayer(id: string, label?: string) {
  return invoke<CustomMediaPlayer[]>("add_custom_media_player", { id, label });
}

export function removeCustomMediaPlayer(id: string) {
  return invoke<CustomMediaPlayer[]>("remove_custom_media_player", { id });
}

export function listMediaPlayerCandidates() {
  return invoke<CustomMediaPlayer[]>("list_media_player_candidates");
}

export const MEDIA_SESSION_CHANGED_EVENT = "media-session-changed";

export type MediaSessionChange = {
  kind: "track" | "playback";
  at: number;
  sessionId: string | null;
};

export function listenMediaSessionChanges(handler: (change: MediaSessionChange) => void) {
  return listen<MediaSessionChange>(MEDIA_SESSION_CHANGED_EVENT, ({ payload }) => handler(payload));
}
