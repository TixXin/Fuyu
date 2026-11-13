import type { AgentApprovalRequest } from "../../../../src/features/agent-status/approvals/api";
import durations from "../../../assets/voice/004-one-day/durations.json";
import type { Director } from "../../stage/director";
import { island } from "../../stage/island";
import { sound } from "../../stage/sound";
import { ZOOM, hideCaption, moveCamera, showCaption, stage } from "../../stage/stageState";
import { copyFor as sharedCopy, type Copy as SharedCopy } from "../001-one-island/copy";
import { playingMedia, sessions } from "../001-one-island/seed";
import type { Lang } from "../types";
import { copyFor } from "./copy";
import narration from "./narration.json";
import { scenes, type SceneId } from "./scenes";

type Line = keyof typeof narration.zh;
const LINES: Line[] = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"];
const GAP = 500;
const LEAD = 600;
const TAIL = 2200;
const HOLD: Partial<Record<Line, number>> = { l5: 600, l6: 300, l7: 1500, l8: 2400 };

export function beats(lang: Lang) {
  const starts = {} as Record<Line, number>;
  let at = LEAD;
  for (const line of LINES) {
    starts[line] = at;
    at += durations[lang][line] + GAP + (HOLD[line] ?? 0);
  }
  return { starts, total: at - GAP + TAIL };
}

async function messagesArrive(copy: SharedCopy, which: "qq" | "wechat" | "mail") {
  const world = island.world();
  const at = Date.now();
  if (which === "qq") {
    world.qq = { ...world.qq, revision: world.qq.revision + 1, items: [{ id: "q1", title: copy.qq.title, body: copy.qq.body, createdAt: at }] };
    await island.emit("qq-notifications-changed", { snapshot: world.qq, newestId: "q1", windowVisible: true });
  } else if (which === "wechat") {
    const message = { ...copy.wechat, unread: 2, at };
    world.wechat = { ...world.wechat, revision: world.wechat.revision + 1, pending: true, lastAttentionAt: at, message, items: [{ at, message, reason: null }] };
    await island.emit("wechat-reminder-changed", { snapshot: world.wechat, windowVisible: true });
  } else {
    world.mail = {
      ...world.mail, revision: world.mail.revision + 1, unreadCount: 1,
      items: [{ id: "m1", uid: 1, sender: copy.mail.sender, subject: copy.mail.subject, unread: true, receivedAt: at }],
    };
    await island.emit("qq-mail-changed", { snapshot: world.mail, newestId: "m1", windowVisible: true });
  }
}

function agentsStart(copy: SharedCopy) {
  const world = island.world();
  const now = Date.now();
  world.sessions = sessions(copy, now);
  world.agentStatus = { ...world.agentStatus, claudeCode: { phase: "running", updatedAt: now, title: copy.sessions[0] }, updatedAt: now };
}

async function approvalArrives(note: string) {
  const world = island.world();
  world.sessions = world.sessions.map((session) => session.sessionId === "s1" ? { ...session, phase: "waiting", updatedAt: Date.now() } : session);
  const request: AgentApprovalRequest = {
    id: 7, kind: "permission", agent: "claudeCode", sessionId: "s1", cwd: "E:\\Projects\\fuyu", toolName: "Bash",
    toolInput: { command: "pnpm test:regression clipboard", description: note },
    permissionSuggestions: null, receivedAt: Date.now(),
  };
  world.approvals = [request];
  sound("approval");
  await island.emit("agent-approval-requested", request);
}

function approvalDone() {
  const world = island.world();
  world.sessions = world.sessions.map((session) => session.sessionId === "s1"
    ? { ...session, phase: "running", updatedAt: Date.now(), currentTool: { name: "Bash", detail: "pnpm test:regression clipboard" } }
    : session);
}

export function script(director: Director, lang: Lang) {
  const copy = copyFor(lang);
  const shared = sharedCopy(lang);
  const inks = Object.fromEntries(scenes(lang).map((scene) => [scene.id, scene.ink]));
  const { at } = director;
  const { starts } = beats(lang);
  const enter = (id: SceneId) => stage.set({ scene: id, ink: inks[id] });
  LINES.forEach((line) => at(starts[line], () => {
    sound(`voice:${line}`);
    if (line === "l9") hideCaption();
    else showCaption("", narration[lang][line]);
  }));

  at(0, () => stage.set({ scene: "dawn", ink: "light", title: copy.title }));

  at(starts.l2 - 350, () => enter("morning"));
  at(starts.l2 - 200, () => moveCamera(ZOOM.panel, 1000));
  at(starts.l2 + 250, () => island.click(".island__open-button", 0, 650));
  at(starts.l2 + 1700, () => island.click(".todo-island-row__check", 0, 550));
  at(starts.l2 + 2700, () => island.click(".todo-island-row__check", 0, 420));

  at(starts.l3 - 350, () => enter("meeting"));
  at(starts.l3 + 150, () => island.click(".dot-button--calendar", 0, 600));
  at(starts.l3 + 2600, () => island.pointAt(".calendar-event__join", 0, 800));

  at(starts.l4 - 450, () => island.click(".island__collapse-target", 0, 300));
  at(starts.l4 - 350, () => enter("noon"));
  at(starts.l4 - 100, () => {
    island.hideCursor();
    moveCamera(ZOOM.popup, 800);
  });
  at(starts.l4 + 250, () => messagesArrive(shared, "qq"));
  at(starts.l4 + 1350, () => messagesArrive(shared, "wechat"));
  at(starts.l4 + 2450, () => messagesArrive(shared, "mail"));

  at(starts.l5 - 450, () => island.emit("island-outside-click", null));
  at(starts.l5 - 350, () => enter("afternoon"));
  at(starts.l5 - 100, () => moveCamera(ZOOM.panel, 800));
  at(starts.l5 + 100, () => agentsStart(shared));
  at(starts.l5 + 1300, () => approvalArrives(copy.approvalNote));
  at(starts.l5 + 3000, () => island.click(".agent-approval__button--allow", 0, 650));
  at(starts.l5 + 3750, () => sound("ack"));
  at(starts.l5 + 3850, approvalDone);

  at(starts.l6 - 350, () => enter("copy"));
  at(starts.l6 - 100, () => island.click(".island__open-button", 0, 500));
  at(starts.l6 + 650, () => island.click(".dot-button--clipboard", 0, 450));
  at(starts.l6 + 1900, () => island.click(".island-list-row__hit", 2, 550));

  at(starts.l7 - 350, () => enter("translate"));
  at(starts.l7 - 150, () => island.click(".island-translate-button", 0, 500));
  at(starts.l7 + 600, () => island.type(".translation-panel textarea", shared.translate.source, 20));
  at(starts.l7 + 1900, () => island.click(".translation-panel__primary", 0, 400));

  at(starts.l8 - 500, async () => {
    island.world().media = playingMedia(shared, 0);
    await island.emit("media-session-changed", { kind: "track", at: Date.now(), sessionId: "demo" });
  });
  at(starts.l8 - 350, () => enter("night"));
  at(starts.l8 - 100, () => island.click(".dot-button--music", 0, 500));
  at(starts.l8 + 3000, () => island.click(".island__collapse-target", 0, 450));
  at(starts.l8 + 3500, () => {
    island.hideCursor();
    moveCamera(ZOOM.bar, 900);
  });

  at(starts.l9 - 300, () => moveCamera(1, 1000));
  at(starts.l9, () => {
    sound("complete");
    stage.set({ dim: 0.84, endCard: true, title: "" });
  });
}
