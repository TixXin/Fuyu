import type { AgentSessionSummary } from "../../../../src/features/agent-status/api";
import type { World } from "../../app/world";
import type { Lang } from "../types";
import { copyFor, type Copy } from "./copy";

const minute = 60_000;

function sessions(copy: Copy, now: number): AgentSessionSummary[] {
  return [
    {
      provider: "claudeCode", sessionId: "s1", cwd: "E:\\Projects\\fuyu", title: copy.sessionTitles[0],
      model: "Opus 5.5", effort: "high", phase: "running", updatedAt: now - 8_000, turnStartedAt: now - 3 * minute,
      permissionMode: "default", subagents: 1, host: { name: "Windows Terminal", exe: null, kind: "terminal" },
      lastMessage: copy.sessionMessages[0], currentTool: { name: "Edit", detail: "clipboard/search.ts" },
    },
    {
      provider: "codex", sessionId: "s2", cwd: "E:\\Projects\\fuyu-site", title: copy.sessionTitles[1],
      model: "gpt-6-astra", effort: "medium", phase: "running", updatedAt: now - 20_000, turnStartedAt: now - 6 * minute,
      permissionMode: "default", host: { name: "Codex", exe: null, kind: "app" }, lastMessage: copy.sessionMessages[1],
      currentTool: { name: "Read", detail: "docs/releases/draft.md" },
    },
    {
      provider: "claudeCode", sessionId: "s3", cwd: "E:\\Projects\\fuyu-plugins", title: copy.sessionTitles[2],
      model: "Opus 5.5", effort: null, phase: "completed", updatedAt: now - 42 * minute, turnStartedAt: now - 47 * minute,
      permissionMode: "auto", host: null, lastMessage: copy.sessionMessages[2],
    },
  ];
}

export function seed(world: World, lang: Lang) {
  const copy = copyFor(lang);
  const now = Date.now();
  world.sessions = sessions(copy, now);
  world.agentStatus = {
    ...world.agentStatus,
    claudeCode: { phase: "running", updatedAt: now, title: copy.sessionTitles[0] },
    codex: { phase: "running", updatedAt: now, title: copy.sessionTitles[1] },
    updatedAt: now,
  };
  world.settings = { agentTitleMode: "running", agentAlertStarted: "off" };
  world.usage = {
    updatedAt: now, plan: "Max 20x", source: "api",
    fiveHour: { name: "", used: 27, resetsAt: now + 3 * 60 * minute },
    sevenDay: { name: "", used: 62, resetsAt: now + 5 * 24 * 60 * minute },
    models: [],
  };
}
