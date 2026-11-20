import { useTranslation } from "../../../i18n";
import type { AgentSessionSummary } from "../api";
import { AgentNoticeStack } from "../notice/AgentNoticeStack";
import { AgentNoticeWings } from "../notice/AgentNoticeWings";
import type { AgentNoticeNotch, AgentNoticeStack as NoticeStackMode } from "../agentSettings";
import type { AgentNoticeOptions } from "../notice/noticeOptions";
import { AgentApprovalCard } from "./AgentApprovalCard";
import { AgentQuestionCard } from "./AgentQuestionCard";
import type { AgentApprovals } from "./useAgentApprovals";

export function AgentApprovalNotice({
  approvals,
  sessions,
  notice,
  stackMode,
  notch,
  statusInBand,
}: {
  approvals: AgentApprovals;
  sessions: AgentSessionSummary[];
  notice: AgentNoticeOptions;
  stackMode: NoticeStackMode;
  notch: AgentNoticeNotch;
  statusInBand: boolean;
}) {
  const request = approvals.current;
  const t = useTranslation();
  if (!request) return null;
  const items = [{ key: "approval", provider: request.agent, tone: "needs" as const, title: "", state: t.agentNotice.state[request.kind === "question" ? "question" : "needs"] }];
  return (
    <section className="agent-sessions" aria-label={t.agent.sessions.title}>
      <AgentNoticeWings mode={stackMode} notch={notch} items={items} activeKey="approval" />
      <AgentNoticeStack mode={stackMode} notch={notch} items={items} activeKey="approval" onSelect={() => {}}>
        {() => request.kind === "question" ? (
          <AgentQuestionCard approvals={approvals} sessions={sessions} options={notice} statusInBand={statusInBand} />
        ) : (
          <AgentApprovalCard approvals={approvals} sessions={sessions} options={notice} statusInBand={statusInBand} />
        )}
      </AgentNoticeStack>
    </section>
  );
}
