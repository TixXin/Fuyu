import type { ReactNode } from "react";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import type { AgentApprovalRequest } from "../../src/features/agent-status/approvals/api";
import type { AgentApprovals } from "../../src/features/agent-status/approvals/useAgentApprovals";
import { AgentApprovalCard } from "../../src/features/agent-status/approvals/AgentApprovalCard";
import { AgentQuestionCard } from "../../src/features/agent-status/approvals/AgentQuestionCard";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import { DEFAULT_AGENT_NOTICE_OPTIONS, type AgentNoticeOptions } from "../../src/features/agent-status/notice/noticeOptions";
import type { AgentNoticeStyle } from "../../src/features/agent-status/agentSettings";
import { sessionKey } from "../../src/features/agent-status/unseen";

export const STYLES: AgentNoticeStyle[] = ["status", "compact", "wings"];

const LONG_REPLY = [
  "这一轮做完了，改了 6 个文件：",
  "1. `AgentSessionRow.tsx`：标题行去掉模型胶囊，挪进悬停卡",
  "2. `SessionBody.tsx`：最后一条消息改成按 Markdown 显示",
  "3. `AgentNotice.css`：消息最多 6 行，超出在卡片里滚动",
  "4. `useIslandAgentAlerts.ts`：悬停时停住倒计时",
  "5. 两个回归页的快照",
  "验证：",
  "```",
  "pnpm check            ✓",
  "pnpm test:regression  ✓ 14 页",
  "```",
  "**还没做**：Mac 刘海形态的标题带，等你定方向。",
  "没有提交。",
].join("\n");

const base: AgentSessionSummary = {
  provider: "claudeCode", sessionId: "n-working", cwd: "/Users/me/projects/Fuyu", title: "Agent 通知重设计：出预览页挑方向",
  model: "Opus 5.5", effort: null, phase: "running", lastMessage: null, updatedAt: 0, host: null, turnStartedAt: null,
  lastPrompt: "继续完善其他官方插件，按预览页的，派会话并行",
  currentTool: { name: "Bash", detail: "git show --stat a8696e60 | head -40 ~/projects/Fuyu/plugins/v3/official/alarm/manifest.json" },
};

export const SESSIONS: Record<"working" | "needs" | "yourTurn" | "done" | "failed", AgentSessionSummary> = {
  working: base,
  needs: { ...base, provider: "codex", sessionId: "n-needs", title: "修复剪贴板图片粘贴失败", phase: "waiting", currentTool: { name: "Bash", detail: "rm -rf src-tauri/target/agents/debug/incremental/fuyu-3k2j9/" } },
  yourTurn: { ...base, sessionId: "n-turn", title: "Mac 刘海形态的弹出卡片", phase: "completed", replyMarker: "yourTurn", currentTool: null,
    lastMessage: "两种做法：**刘海两边放图标和状态**，或者**整条往下弹**。你选哪种？" },
  done: { ...base, provider: "cursor", sessionId: "n-done", title: "Agent 通知：消息尽量显示全", phase: "completed", currentTool: null, lastMessage: LONG_REPLY },
  failed: { ...base, provider: "kimiCode", sessionId: "n-failed", title: "发布 0.3.11 候选版", phase: "failed", currentTool: null,
    lastMessage: "`pnpm release` 在上传前失败：\n```\nError: TAURI_SIGNING_PRIVATE_KEY is empty\n```\n安装包**没有上传**。" },
};

const reveal = (session: AgentSessionSummary) => ({ key: sessionKey(session), kind: "completed" as const, session, rowHeight: 78, measure: () => {} });

const approvals = (request: AgentApprovalRequest): AgentApprovals => ({ current: request, queued: 1, decide: () => {}, cardHeight: 0, measure: () => {} });

export const permission: AgentApprovalRequest = {
  id: 1, kind: "permission", agent: "codex", sessionId: "n-needs", cwd: "/Users/me/projects/Fuyu", toolName: "Bash",
  toolInput: { command: "rm -rf src-tauri/target/agents/debug/incremental/fuyu-3k2j9/", description: "清理增量缓存" }, permissionSuggestions: null, receivedAt: 0,
};

const question: AgentApprovalRequest = {
  ...permission, id: 2, kind: "question", agent: "claudeCode", sessionId: "n-turn", toolName: "AskUserQuestion",
  toolInput: { questions: [{ question: "刘海两边放什么？", header: "刘海", multiSelect: false, options: [{ label: "图标和状态", description: "" }, { label: "空着", description: "" }] }] },
};

function Frame({ id, width = 380, children }: { id: string; width?: number; children: ReactNode }) {
  return <div className="notice-frame" id={id} style={{ width }}>{children}</div>;
}

const withOptions = (change: Partial<AgentNoticeOptions>): AgentNoticeOptions => ({ ...DEFAULT_AGENT_NOTICE_OPTIONS, ...change });

export function NoticeGallery() {
  const sessions = Object.values(SESSIONS);
  return (
    <>
      {STYLES.map((style) => (
        <div key={style} className="notice-column" data-style={style}>
          {Object.entries(SESSIONS).map(([tone, session]) => (
            <Frame key={tone} id={`${style}-${tone}`}>
              <AgentSessionsPanel sessions={sessions} hostDisplay="off" reveal={reveal(session)} notice={withOptions({ style, messageLines: style === "status" ? 6 : 4, commandLines: style === "status" ? 3 : 2 })} onOpenAgentPage={() => {}} />
            </Frame>
          ))}
          <Frame id={`${style}-approval`}>
            <AgentApprovalCard approvals={approvals(permission)} sessions={sessions} options={withOptions({ style })} />
          </Frame>
          <Frame id={`${style}-question`}>
            <AgentQuestionCard approvals={approvals(question)} sessions={sessions} options={withOptions({ style })} />
          </Frame>
          <Frame id={`${style}-narrow`} width={280}>
            <AgentApprovalCard approvals={approvals(permission)} sessions={sessions} options={withOptions({ style })} />
          </Frame>
        </div>
      ))}
      <div className="notice-column" data-style="options">
        <Frame id="plain-inline">
          <AgentSessionsPanel sessions={sessions} hostDisplay="off" reveal={reveal(SESSIONS.done)} notice={withOptions({ markdown: false, meta: "inline", scrollbar: "always" })} />
        </Frame>
        <Frame id="allow-first">
          <AgentApprovalCard approvals={approvals(permission)} sessions={sessions} options={withOptions({ buttonOrder: "allowLeft", showKeys: false })} />
        </Frame>
      </div>
    </>
  );
}
