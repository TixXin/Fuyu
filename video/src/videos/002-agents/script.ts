import type { AgentApprovalRequest } from "../../../../src/features/agent-status/approvals/api";
import type { AgentSessionSummary } from "../../../../src/features/agent-status/api";
import type { Director } from "../../stage/director";
import { island } from "../../stage/island";
import { sound } from "../../stage/sound";
import { ZOOM, hideCaption, moveCamera, showCaption, stage } from "../../stage/stageState";
import type { Lang } from "../types";
import { copyFor, type Copy } from "./copy";

function patchSession(id: string, patch: Partial<AgentSessionSummary>) {
  const world = island.world();
  world.sessions = world.sessions.map((session) => session.sessionId === id ? { ...session, ...patch, updatedAt: Date.now() } : session);
}

async function approvalArrives(copy: Copy) {
  patchSession("s1", { phase: "waiting" });
  const request: AgentApprovalRequest = {
    id: 7, kind: "permission", agent: "claudeCode", sessionId: "s1", cwd: "E:\\Projects\\fuyu", toolName: "Bash",
    toolInput: { command: "pnpm test:regression clipboard", description: copy.approvalNote },
    permissionSuggestions: null, receivedAt: Date.now(),
  };
  island.world().approvals = [request];
  sound("approval");
  await island.emit("agent-approval-requested", request);
}

export function script(director: Director, lang: Lang) {
  const copy = copyFor(lang);
  const { at } = director;
  const caption = (pair: string[]) => showCaption(pair[0], pair[1]);

  at(100, () => stage.set({ clutter: "in", title: copy.title }));
  at(700, () => showCaption("", copy.hook));
  at(3300, hideCaption);
  at(3400, () => {
    sound("start");
    stage.set({ islandVisible: true, clutter: "back" });
  });
  at(3900, () => caption(copy.watch));
  at(4100, () => moveCamera(ZOOM.bar, 900));

  at(6500, hideCaption);
  at(6600, () => moveCamera(ZOOM.panel, 700));
  at(6700, () => approvalArrives(copy));
  at(7200, () => caption(copy.approve));
  at(9300, () => island.click(".agent-approval__button--allow", 0, 700));
  at(10100, () => sound("ack"));
  at(10200, () => patchSession("s1", { phase: "running", currentTool: { name: "Bash", detail: "pnpm test:regression clipboard" } }));
  at(10300, () => island.hideCursor());
  at(10500, hideCaption);

  at(11200, () => island.click(".island__open-button", 0, 600));
  at(11600, () => caption(copy.sessions));
  at(13400, () => {
    sound("complete");
    patchSession("s2", { phase: "completed", currentTool: null });
  });

  at(15300, () => caption(copy.jump));
  at(15500, () => island.click("[data-session-key='claudeCode:s1'] .agent-session", 0, 700));
  at(16400, () => {
    stage.set({ clutter: "front" });
    void island.click(".island__collapse-target", 0, 1);
  });
  at(16700, () => island.hideCursor());
  at(16700, () => moveCamera(1, 900));

  at(19000, hideCaption);
  at(19300, () => {
    sound("complete");
    stage.set({ dim: 0.72, endCard: true, clutter: "absorbed", title: "" });
  });
}
