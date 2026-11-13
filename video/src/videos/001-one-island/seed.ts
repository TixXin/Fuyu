import type { World } from "../../app/world";
import type { MediaState } from "../../../../src/features/media/api";
import type { AgentSessionSummary } from "../../../../src/features/agent-status/api";
import type { ClipboardHistoryItem } from "../../../../src/features/clipboard/api";
import type { Lang } from "../types";
import { copyFor, type Copy } from "./copy";

const minute = 60_000;

function today() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const cover = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#f0986a"/><stop offset=".6" stop-color="#b1447c"/><stop offset="1" stop-color="#4a2f86"/></linearGradient></defs><rect width="112" height="112" fill="url(#g)"/><path d="M18 78c14-12 26-18 40-16 10-10 26-8 34 4 8 2 14 6 18 12z" fill="#1d2a44"/></svg>',
)}`;

export function lrc(copy: Copy) {
  const stamps = ["00:00.40", "00:03.60", "00:06.80", "00:10.00", "00:13.20"];
  return copy.lyrics.map((line, index) => `[${stamps[index]}]${line}`).join("\n");
}

export function playingMedia(copy: Copy, positionMs: number): MediaState {
  return {
    available: true, audioActive: true, audioPeak: 0.5, playbackStatus: "playing",
    title: copy.song.title, artist: copy.song.artist, album: copy.song.album, thumbnail: cover,
    positionMs, durationMs: 214_000, positionEstimate: "timed",
    canSeek: true, canNext: true, canPrevious: true, shuffleActive: false, canShuffle: true,
    repeatMode: "none", canRepeat: true, volume: 0.6, sourceApp: null, activeSessionId: "demo",
    sessions: [{ id: "demo", label: copy.song.player, playing: true }], updatedAt: Date.now(),
  };
}

export function sessions(copy: Copy, now: number): AgentSessionSummary[] {
  return [
    {
      provider: "claudeCode", sessionId: "s1", cwd: "E:\\Projects\\fuyu", title: copy.sessions[0],
      model: "Opus 5.5", effort: "high", phase: "running", updatedAt: now - 8_000, turnStartedAt: now - 3 * minute,
      permissionMode: "default", subagents: 1, host: { name: "Windows Terminal", exe: null, kind: "terminal" },
      lastMessage: copy.sessionMessages[0], currentTool: { name: "Edit", detail: "clipboard/search.ts" },
    },
    {
      provider: "codex", sessionId: "s2", cwd: "E:\\Projects\\fuyu-site", title: copy.sessions[1],
      model: "gpt-6-astra", effort: "medium", phase: "completed", updatedAt: now - 6 * minute, turnStartedAt: now - 9 * minute,
      permissionMode: "default", host: { name: "Codex", exe: null, kind: "app" }, lastMessage: copy.sessionMessages[1],
    },
    {
      provider: "claudeCode", sessionId: "s3", cwd: "E:\\Projects\\fuyu-plugins", title: copy.sessions[2],
      model: "Opus 5.5", effort: null, phase: "completed", updatedAt: now - 42 * minute, turnStartedAt: now - 47 * minute,
      permissionMode: "auto", host: null, lastMessage: copy.sessionMessages[2],
    },
  ];
}

export function clips(copy: Copy, now: number): ClipboardHistoryItem[] {
  const base = { hash: "", createdAt: now, favorite: false } as const;
  const source = (index: number) => ({ path: "", name: copy.clipSources[index] });
  return [
    { ...base, id: "c1", kind: "text", copiedAt: now - 40_000, preview: copy.clips[0], source: source(0), favorite: true },
    { ...base, id: "c2", kind: "text", copiedAt: now - 3 * minute, preview: copy.clips[1], source: source(1) },
    { ...base, id: "c3", kind: "text", copiedAt: now - 9 * minute, preview: copy.clips[2], source: source(2) },
    { ...base, id: "c4", kind: "image", copiedAt: now - 16 * minute, preview: "1280 x 720 image", image: { width: 1280, height: 720, byteSize: 1, originalPath: "", thumbnailPath: "", thumbnailDataUrl: cover }, source: source(3) },
    { ...base, id: "c5", kind: "text", copiedAt: now - 31 * minute, preview: copy.clips[3], source: source(3) },
  ];
}

export function seed(world: World, lang: Lang) {
  const copy = copyFor(lang);
  const now = Date.now();
  world.todos = {
    date: today(),
    todos: copy.todos.map((title, index) => ({ id: `t${index}`, title, completed: index === 3, createdAt: now - index * minute })),
    scheduled: [], archives: [], dailyNote: "", activeTodoId: null,
  };
  world.lyrics[copy.song.title] = { source: "local", lrc: lrc(copy) };
  world.clipboard = clips(copy, now);
  world.translations[copy.translate.source] = copy.translate.result;
  world.audioPeak = () => 0.32 + 0.28 * Math.abs(Math.sin(Date.now() / 173)) + 0.18 * Math.abs(Math.sin(Date.now() / 61));
}
