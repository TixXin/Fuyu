import type { AgentSessionSummary, SessionProvider } from "../../../../src/features/agent-status/api";
import type { World } from "../../app/world";
import wallpaper from "../003-messages/wallpaper.jpg";
import type { Lang } from "../types";
import { BEAT } from "./beats";
import { copyFor, type Copy } from "./copy";
import { MARKET } from "./market";
import { lrc } from "./music";

const minute = 60_000;

const RUNS: { provider: SessionProvider; model: string; effort: string | null; tool: [string, string] | null; ago: number }[] = [
  { provider: "claudeCode", model: "Opus 5.5", effort: "high", tool: ["Bash", "pnpm test:regression settings"], ago: 4 },
  { provider: "codex", model: "gpt-6-astra", effort: "medium", tool: ["Edit", "clipboard/search.ts"], ago: 7 },
  { provider: "opencode", model: "Kimi K3", effort: null, tool: ["edit", "marketFilter.ts"], ago: 3 },
  { provider: "qwen", model: "Qwen4-Coder", effort: null, tool: ["Edit", "README.en.md"], ago: 2 },
  { provider: "kimiCode", model: "Kimi K3", effort: null, tool: ["Write", "calendar/timezone.test.mjs"], ago: 5 },
  { provider: "copilot", model: "Sonnet 5.5", effort: null, tool: ["Edit", ".github/workflows/check.yml"], ago: 6 },
];

const PHASES: AgentSessionSummary["phase"][] = ["running", "running", "running", "running", "running", "running"];

function sessions(copy: Copy, now: number): AgentSessionSummary[] {
  return RUNS.map((run, index) => ({
    provider: run.provider, sessionId: `s${index + 1}`, cwd: String.raw`D:\code\fuyu`, title: copy.sessions[index].title,
    model: run.model, effort: run.effort, phase: PHASES[index], updatedAt: now - 5_000, turnStartedAt: now - run.ago * minute,
    permissionMode: "default", host: { name: "Windows Terminal", exe: null, kind: "terminal" },
    lastMessage: copy.sessions[index].message, currentTool: run.tool ? { name: run.tool[0], detail: run.tool[1] } : null,
  }));
}

function today() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function seed(world: World, lang: Lang) {
  const copy = copyFor(lang);
  const now = Date.now();
  world.sessions = sessions(copy, now);
  world.agentStatus = {
    ...world.agentStatus,
    claudeCode: { phase: "running", updatedAt: now, title: copy.sessions[0].title },
    codex: { phase: "running", updatedAt: now, title: copy.sessions[1].title },
    updatedAt: now,
  };
  world.usage = {
    updatedAt: now, plan: "Max 20x", source: "api",
    fiveHour: { name: "", used: 41, resetsAt: now + 3 * 60 * minute },
    sevenDay: { name: "", used: 58, resetsAt: now + 5 * 24 * 60 * minute },
    models: [],
  };
  world.codexUsage = {
    updatedAt: now, plan: "Pro", source: "api",
    fiveHour: { name: "", used: 27, resetsAt: now + 2 * 60 * minute },
    sevenDay: { name: "", used: 44, resetsAt: now + 4 * 24 * 60 * minute },
    models: [],
  };
  world.builtins = [{ id: "claude-usage", kind: "builtin", enabled: true, background: [], config: { claudeCode: true, codex: true } }];
  world.todos = {
    date: today(),
    todos: copy.todos.map((title, index) => ({ id: `t${index}`, title, completed: false, createdAt: now - index * minute })),
    scheduled: [], archives: [], dailyNote: "", activeTodoId: null,
  };
  const start = now + BEAT.meeting + 5 * minute;
  world.calendar = [{
    uid: "standup", title: copy.meeting.title, startMs: start, endMs: start + 15 * minute, allDay: false,
    location: copy.meeting.location, meetingLink: "https://meeting.dingtalk.com/j/fuyu-standup", calendar: "钉钉",
  }];
  world.wallpaper = wallpaper;
  world.market = MARKET;
  world.lyrics[copy.song.title] = { source: "local", lrc: lrc(copy) };
  world.audioPeak = () => 0.32 + 0.28 * Math.abs(Math.sin(Date.now() / 173)) + 0.18 * Math.abs(Math.sin(Date.now() / 61));
  world.mailBodies.m1 = { id: "m1", content: copy.mail.body, contentType: "text/plain", attachments: [] };
  world.settings = { agentTitleMode: "running", agentAlertStarted: "off", calendarRemindMinutes: 5, maxPanelHeight: 520, lyricsKaraoke: true, expandTrigger: "click" };
}
