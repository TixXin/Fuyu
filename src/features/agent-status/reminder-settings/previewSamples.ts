import type { AgentSessionSummary } from "../api";
import type { AgentApprovalRequest } from "../approvals/api";
import type { SettingsAgentNoticeText } from "../../../i18n/sections/settings/agentNotice";
import type { PreviewEvent } from "./previewEvents.ts";

type SampleText = SettingsAgentNoticeText["preview"]["sample"];

const CWD = "/Users/me/projects/Fuyu";
const APPROVAL_COMMAND =
  "cd ~/projects/Fuyu && rm -rf src-tauri/target/agents/debug/incremental/fuyu-3k2j9 && cargo test --manifest-path src-tauri/Cargo.toml --target-dir src-tauri/target/agents -- clipboard::image --nocapture";
const RUNNING_COMMAND = "pnpm test:regression agent-alert --update-snapshots && git status --short docs/ src/features/agent-status/ && pnpm check";

export type PreviewSamples = {
  sessions: Record<Exclude<PreviewEvent, "stack">, AgentSessionSummary>;
  requests: Record<"approval" | "question", AgentApprovalRequest>;
  stack: readonly AgentSessionSummary[];
};

export function previewSamples(text: SampleText): PreviewSamples {
  const base: AgentSessionSummary = {
    provider: "claudeCode",
    sessionId: "preview-started",
    cwd: CWD,
    title: text.startedTitle,
    model: "Opus 5.5",
    effort: null,
    phase: "running",
    lastMessage: null,
    updatedAt: 0,
    host: null,
    turnStartedAt: null,
    lastPrompt: text.prompt,
    currentTool: { name: "Bash", detail: RUNNING_COMMAND },
  };
  const ended = { ...base, phase: "completed" as const, currentTool: null };
  const sessions: PreviewSamples["sessions"] = {
    started: base,
    approval: { ...base, provider: "codex", sessionId: "preview-approval", title: text.approvalTitle, model: "GPT-5.5", phase: "waiting", currentTool: { name: "Bash", detail: APPROVAL_COMMAND } },
    question: { ...base, sessionId: "preview-question", title: text.questionTitle, phase: "waiting", currentTool: null },
    yourTurn: { ...ended, sessionId: "preview-your-turn", title: text.yourTurnTitle, replyMarker: "yourTurn", lastMessage: text.yourTurnMessage },
    done: { ...ended, sessionId: "preview-done", title: text.doneTitle, lastMessage: text.doneMessage },
    failed: { ...ended, provider: "kimiCode", sessionId: "preview-failed", title: text.failedTitle, model: "K2.5", phase: "failed", lastMessage: text.failedMessage },
  };
  const request: AgentApprovalRequest = {
    id: 1,
    kind: "permission",
    agent: "codex",
    sessionId: sessions.approval.sessionId,
    cwd: CWD,
    toolName: "Bash",
    toolInput: { command: APPROVAL_COMMAND },
    permissionSuggestions: null,
    receivedAt: 0,
  };
  const question: AgentApprovalRequest = {
    ...request,
    id: 2,
    kind: "question",
    agent: "claudeCode",
    sessionId: sessions.question.sessionId,
    toolName: "AskUserQuestion",
    toolInput: {
      questions: [{ question: text.question, header: text.questionHeader, multiSelect: false, options: text.questionOptions.map((label) => ({ label, description: "" })) }],
    },
  };
  return { sessions, requests: { approval: request, question }, stack: [sessions.failed, sessions.yourTurn, sessions.done] };
}
