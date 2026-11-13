import type { AgentApprovalRequest } from "../../../../src/features/agent-status/approvals/api";
import type { Director } from "../../stage/director";
import { island } from "../../stage/island";
import { sound } from "../../stage/sound";
import { ZOOM, hideCaption, moveCamera, showCaption, stage } from "../../stage/stageState";
import type { Lang } from "../types";
import { copyFor, type Copy } from "./copy";
import { playingMedia, sessions } from "./seed";

async function startMusic(copy: Copy) {
  island.world().media = playingMedia(copy, 0);
  await island.emit("media-session-changed", { kind: "track", at: Date.now(), sessionId: "demo" });
}

async function qqArrives(copy: Copy) {
  const world = island.world();
  world.qq = { ...world.qq, revision: world.qq.revision + 1, items: [{ id: "q1", title: copy.qq.title, body: copy.qq.body, createdAt: Date.now() }] };
  await island.emit("qq-notifications-changed", { snapshot: world.qq, newestId: "q1", windowVisible: true });
}

async function wechatArrives(copy: Copy) {
  const world = island.world();
  const message = { ...copy.wechat, unread: 2, at: Date.now() };
  world.wechat = {
    ...world.wechat, revision: world.wechat.revision + 1, pending: true, lastAttentionAt: Date.now(), message,
    items: [{ at: Date.now(), message, reason: null }],
  };
  await island.emit("wechat-reminder-changed", { snapshot: world.wechat, windowVisible: true });
}

async function mailArrives(copy: Copy) {
  const world = island.world();
  world.mail = {
    ...world.mail, revision: world.mail.revision + 1, unreadCount: 1,
    items: [{ id: "m1", uid: 1, sender: copy.mail.sender, subject: copy.mail.subject, unread: true, receivedAt: Date.now() }],
  };
  await island.emit("qq-mail-changed", { snapshot: world.mail, newestId: "m1", windowVisible: true });
}

function agentsStart(copy: Copy) {
  const world = island.world();
  const now = Date.now();
  world.sessions = sessions(copy, now);
  world.agentStatus = { ...world.agentStatus, claudeCode: { phase: "running", updatedAt: now, title: copy.sessions[0] }, updatedAt: now };
}

async function approvalArrives(lang: Lang) {
  const world = island.world();
  world.sessions = world.sessions.map((session) => session.sessionId === "s1" ? { ...session, phase: "waiting", updatedAt: Date.now() } : session);
  const request: AgentApprovalRequest = {
    id: 7, kind: "permission", agent: "claudeCode", sessionId: "s1", cwd: "E:\\Projects\\fuyu", toolName: "Bash",
    toolInput: { command: "pnpm test:regression clipboard", description: lang === "en" ? "Run the clipboard regression tests" : "运行剪贴板的回归测试" },
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
  const { at } = director;
  const caption = (pair: string[]) => showCaption(pair[0], pair[1]);

  at(200, () => stage.set({ clutter: "in", title: copy.title }));
  at(900, () => showCaption("", copy.hook));
  at(4300, hideCaption);
  at(4500, () => {
    sound("whoosh");
    stage.set({ clutter: "absorbed" });
  });
  at(5150, () => {
    sound("start");
    stage.set({ islandVisible: true });
  });
  at(5700, () => caption(copy.reveal));
  at(7300, () => moveCamera(ZOOM.panel, 1000));
  at(7700, hideCaption);

  at(8100, () => caption(copy.todo));
  at(8200, () => island.click(".island__open-button", 0, 650));
  at(10000, () => island.click(".todo-island-row__check", 0, 600));
  at(11300, () => island.click(".todo-island-row__check", 0, 420));

  at(12300, () => startMusic(copy));
  at(12500, hideCaption);
  at(12700, () => island.click(".dot-button--music", 0, 520));
  at(13000, () => caption(copy.music));
  at(16300, () => island.click(".island__collapse-target", 0, 480));
  at(16500, () => island.hideCursor());
  at(16900, () => moveCamera(ZOOM.bar, 900));

  at(19000, hideCaption);
  at(19100, () => moveCamera(ZOOM.popup, 700));
  at(19200, () => qqArrives(copy));
  at(19500, () => caption(copy.messages));
  at(20300, () => wechatArrives(copy));
  at(21300, () => mailArrives(copy));
  at(23300, () => island.emit("island-outside-click", null));
  at(23400, hideCaption);

  at(23600, () => moveCamera(ZOOM.panel, 800));
  at(24100, () => island.click(".island__open-button", 0, 520));
  at(24900, () => island.click(".dot-button--clipboard", 0, 420));
  at(25300, () => caption(copy.clipboard));
  at(26300, () => island.pointAt(".island-list-row__hit", 1, 600));
  at(27300, () => island.click(".island-list-row__hit", 2, 500));

  at(28200, hideCaption);
  at(28300, () => island.click(".island-translate-button", 0, 560));
  at(28900, () => caption(copy.translation));
  at(29300, () => island.type(".translation-panel textarea", copy.translate.source, 26));
  at(30900, () => island.click(".translation-panel__primary", 0, 420));

  at(33200, hideCaption);
  at(33300, () => agentsStart(copy));
  at(33400, () => island.click(".island__agent-button", 0, 560));
  at(34000, () => caption(copy.agents));
  at(35400, () => approvalArrives(lang));
  at(37400, () => island.click(".agent-approval__button--allow", 0, 620));
  at(38100, () => sound("ack"));
  at(38200, approvalDone);

  at(39600, hideCaption);
  at(39700, () => island.click(".window-actions > .icon-button:last-child", 0, 520));
  at(40300, () => island.hideCursor());
  at(40400, () => moveCamera(1, 1100));
  at(40700, () => caption(copy.tuck));
  at(42900, hideCaption);
  at(43200, () => {
    sound("complete");
    stage.set({ dim: 0.72, endCard: true, title: "" });
  });
}
