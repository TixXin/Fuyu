import { Archive } from "lucide-react";
import type { Translations } from "../../../i18n";
import type { AgentCardEffects } from "../agentSettings";
import { revealAgentSessionFolder, type AgentSessionSummary } from "../api";
import { AgentSessionChildren } from "../AgentSessionChildren";
import { AgentSessionRowMenu } from "../AgentSessionRowMenu";
import { AgentSubagents, listedSubagents } from "../AgentSubagents";
import { shownEffort } from "../effortLabels";
import type { NestedSessions } from "../sessionChildren";
import { SessionElapsed } from "../SessionElapsed";
import { isActivePhase, modelLabel, sessionAge, sessionProject } from "../sessionList";
import { sessionLight } from "../sessionLight";
import { pillParts } from "../sessionPill";
import { getAgentPhaseLabel, getAgentProviderLabel } from "../status";
import { asksUser, sessionKey } from "../unseen";
import type { SessionRemoval } from "../useHiddenSessions";
import type { UnseenSessions } from "../useUnseenSessions";
import type { SessionViewItem } from "./types";

const MAX_CHILD_DEPTH = 3;

export type BuildItemContext = {
  t: Translations;
  now: number;
  effortLabels: Record<string, Record<string, string>>;
  nested: NestedSessions;
  childDepth: Map<string, number>;
  showElapsed: boolean;
  showModel: boolean;
  cardEffects: AgentCardEffects;
  unseen?: UnseenSessions;
  removal?: SessionRemoval;
  notFoundId: string | null;
  notFoundReasonFor: (sessionId: string) => "notRunning" | "hidden" | null;
  rowNotice: { key: string; text: string } | null;
  menuKey: string | null;
  openSubagents: { isOpen: (key: string) => boolean; toggle: (key: string) => void };
  openChildren: { isOpen: (key: string) => boolean; toggle: (key: string) => void };
  onFocus: (session: AgentSessionSummary) => void;
  onArchiveSession: (session: AgentSessionSummary) => void;
  onRowNotice: (notice: { key: string; text: string }) => void;
  onMenuOpenChange: (key: string, open: boolean) => void;
};

export function buildSessionItem(session: AgentSessionSummary, ctx: BuildItemContext): SessionViewItem {
  const { t } = ctx;
  const key = sessionKey(session);
  const project = sessionProject(session.cwd);
  const title = session.title ?? project ?? getAgentProviderLabel(session.provider);
  const model = modelLabel(session.model, shownEffort(session.provider, session.effort, ctx.effortLabels));
  const active = isActivePhase(session.phase);
  const light = sessionLight(session);
  const yourTurn = light === "yourTurn";
  const urgent = light === "needs" || light === "failed" || yourTurn;
  const phaseLabel = session.compacting ? t.agent.sessions.compacting : yourTurn ? t.agent.sessions.yourTurn : getAgentPhaseLabel(session.phase, t);
  const showPhase = session.compacting || yourTurn || (session.phase !== "running" && session.phase !== "completed");
  const mode = session.permissionMode && session.permissionMode !== "default" ? t.agent.sessions.permissionModes[session.permissionMode] : null;
  const pill = pillParts(active && ctx.showModel ? model : null, session.model);
  const pillMode = active ? mode : null;
  const pillTitle = [model && active && ctx.showModel ? model : null, pillMode].filter(Boolean).join(" · ");
  const hasSubagents = listedSubagents(session).length > 0;
  const hasChildren = ctx.nested.children.has(key);
  const subagents = !hasSubagents && !hasChildren ? undefined : (
    <>
      {hasSubagents && <AgentSubagents session={session} open={ctx.openSubagents.isOpen(key)} onToggle={() => ctx.openSubagents.toggle(key)} />}
      {hasChildren && (
        <AgentSessionChildren
          sessions={ctx.nested.children.get(key) ?? []}
          open={ctx.openChildren.isOpen(key)}
          unseen={ctx.unseen?.keys}
          onToggle={() => ctx.openChildren.toggle(key)}
        />
      )}
    </>
  );
  const elapsed = ctx.showElapsed && session.turnStartedAt !== null;
  const statusParts = [
    elapsed && <SessionElapsed key="elapsed" session={session} />,
    active && session.subagents && !subagents ? t.agent.sessions.subagents(session.subagents) : null,
    session.todos && (
      <span key="todos" className="agent-session__todos" title={session.todos.current ? t.agent.sessions.todosCurrent(session.todos.current) : undefined}>
        {t.agent.sessions.todos(session.todos.done, session.todos.total)}
      </span>
    ),
    session.backgroundTasks ? t.agent.sessions.backgroundTasks(session.backgroundTasks) : null,
  ].filter(Boolean).flatMap((part, index) => (index === 0 ? [part] : [" · ", part]));
  const reason = ctx.notFoundReasonFor(session.sessionId);
  const notFound = ctx.notFoundId === session.sessionId
    ? session.remoteHost ? t.agent.sessions.remoteOnly(session.remoteHost)
      : reason ? t.agent.sessions.notFoundReason[reason](getAgentProviderLabel(session.provider))
      : active ? t.agent.sessions.notFound : t.agent.sessions.notFoundEnded
    : ctx.rowNotice?.key === key ? ctx.rowNotice.text : null;
  const isUnseen = Boolean(ctx.unseen?.keys.has(key));
  const looked = Boolean(ctx.unseen && !ctx.unseen.keys.has(key) && asksUser(session));
  const orbit = ctx.cardEffects === "orbit" && light === "needs" && !looked;
  const onArchive = ctx.removal ? () => ctx.onArchiveSession(session) : undefined;
  const menu = (
    <AgentSessionRowMenu
      session={session}
      title={title}
      onFocusWindow={() => ctx.onFocus(session)}
      onArchive={onArchive}
      onNotice={(text) => ctx.onRowNotice({ key, text })}
      onOpenChange={(open) => ctx.onMenuOpenChange(key, open)}
    />
  );
  const archive = ctx.removal && (
    <button className="agent-session__archive" type="button" aria-label={t.agent.sessions.remove(title)} title={t.agent.sessions.remove(title)} onClick={() => ctx.onArchiveSession(session)}>
      <Archive size={14} strokeWidth={2} aria-hidden="true" />
    </button>
  );
  const cwd = session.cwd;
  const onReveal = cwd && !session.remoteHost ? () => {
    revealAgentSessionFolder(cwd).catch((error) => {
      console.error("Failed to reveal the agent session folder", error);
      ctx.onRowNotice({ key, text: t.agent.sessions.menu.revealFailed });
    });
  } : undefined;
  const onCopyPath = cwd ? () => {
    void navigator.clipboard.writeText(cwd).then(
      () => ctx.onRowNotice({ key, text: t.agent.sessions.menu.copied }),
      (error) => console.error("Failed to copy the session path", error),
    );
  } : undefined;

  return {
    key,
    session,
    title,
    project,
    model,
    pill,
    pillMode,
    pillTitle,
    light,
    active,
    urgent,
    phaseLabel,
    showPhase,
    lightText: t.agent.sessions.lights[light],
    statusParts,
    age: sessionAge(session.updatedAt, ctx.now),
    showAge: session.phase !== "running" || !(ctx.showElapsed && session.turnStartedAt !== null),
    unseen: isUnseen,
    looked,
    orbit,
    notFound,
    depth: Math.min(ctx.childDepth.get(key) ?? 0, MAX_CHILD_DEPTH),
    subagents,
    menu,
    archive,
    hoverSuppressed: ctx.menuKey !== null,
    onOpen: () => ctx.onFocus(session),
    onReveal,
    onCopyPath,
    onArchive,
  };
}
