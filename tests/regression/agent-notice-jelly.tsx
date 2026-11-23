import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { AgentLightStyle } from "../../src/lib/settings/types";
import type { AgentNoticeStyle } from "../../src/features/agent-status/agentSettings";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { AgentSessionNotice } from "../../src/features/agent-status/notice/AgentSessionNotice";
import { DEFAULT_AGENT_NOTICE_OPTIONS } from "../../src/features/agent-status/notice/noticeOptions";
import { SessionLightStyleContext } from "../../src/features/agent-status/SessionLightMark";
import { SESSIONS } from "./agentNoticeGallery";

type Check = (condition: unknown, label: string) => void;

export async function checkNoticeJellies(check: Check) {
  const host = document.createElement("div");
  host.style.width = "380px";
  document.body.append(host);
  const root = createRoot(host);
  const show = async (light: AgentLightStyle, style: AgentNoticeStyle, session: AgentSessionSummary) => {
    await act(async () => {
      root.render(
        <StrictMode>
          <SessionLightStyleContext.Provider value={light}>
            <AgentSessionNotice session={session} options={{ ...DEFAULT_AGENT_NOTICE_OPTIONS, style }} model={null} count={null} icon={null} onOpen={() => {}} />
          </SessionLightStyleContext.Provider>
        </StrictMode>,
      );
    });
  };
  const mood = () => host.querySelector<HTMLElement>(".agent-notice__jelly .center-jelly")?.dataset.mood;

  await show("mark", "status", SESSIONS.needs);
  const badged = host.querySelector(".agent-notice__main > .agent-notice__jelly--badged");
  check(badged && mood() === "waiting" && badged.querySelector(".agent-notice__badge .agent-provider-icon") && !host.querySelector(".agent-notice__icon"),
    `卡片通知：状态灯选水母时，左边是按状态动的水母，品牌缩成角标：${mood()}`);

  await show("mark", "compact", SESSIONS.failed);
  const state = host.querySelector(".agent-notice__row > .agent-notice__state");
  check(mood() === "failed" && !host.querySelector(".agent-notice__badge") && state?.nextElementSibling?.classList.contains("agent-notice__brand"),
    `紧凑通知：水母在前不带角标，品牌图标挪到状态文字后面：${mood()}`);

  await show("mark", "status", { ...SESSIONS.working, compacting: true });
  check(mood() === "compacting", `压缩上下文的会话在通知里也是挤眼的水母：${mood()}`);

  await show("mark", "wings", SESSIONS.needs);
  check(host.querySelector(".agent-notice__band > .agent-notice__icon") && !host.querySelector(".agent-notice__jelly, .agent-notice__brand"), "刘海两翼保留带色环的品牌图标，不换水母");

  await show("dot", "status", SESSIONS.needs);
  check(host.querySelector(".agent-notice__main > .agent-notice__icon") && !host.querySelector(".agent-notice__jelly"), "状态灯选圆点时通知照旧是品牌图标");

  act(() => root.unmount());
  host.remove();
}
