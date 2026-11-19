import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import type { AgentNoticeStack as StackMode } from "../../src/features/agent-status/agentSettings";
import { AgentNoticeStack } from "../../src/features/agent-status/notice/AgentNoticeStack";
import { AgentSessionNotice } from "../../src/features/agent-status/notice/AgentSessionNotice";
import { DEFAULT_AGENT_NOTICE_OPTIONS, noticeTone } from "../../src/features/agent-status/notice/noticeOptions";
import type { AgentNoticeStackItem } from "../../src/features/agent-status/notice/noticeStack";
import { sessionKey } from "../../src/features/agent-status/unseen";
import { SESSIONS } from "./agentNoticeGallery";
import { until } from "./pollUntil";
import "../../src/styles/tokens.css";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
const STATE: Record<string, string> = { working: "运行中", needs: "等你确认", yourTurn: "等你回复", done: "完成", failed: "出错" };
const opened: string[] = [];

const itemOf = (session: AgentSessionSummary): AgentNoticeStackItem => {
  const tone = noticeTone(session);
  return { key: sessionKey(session), provider: session.provider, tone, title: session.title ?? "", state: STATE[tone] };
};

function Stack({ mode, sessions }: { mode: StackMode; sessions: AgentSessionSummary[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const items = sessions.map(itemOf);
  const active = sessions.find((session) => sessionKey(session) === activeKey) ?? sessions[0];
  return (
    <div className="notice-frame" id={`stack-${mode}-${sessions.length}`} style={{ width: 380 }}>
      <AgentNoticeStack mode={mode} notch="below" items={items} activeKey={activeKey} onSelect={setActiveKey}>
        {({ count, icon }) => (
          <AgentSessionNotice
            session={active}
            options={{ ...DEFAULT_AGENT_NOTICE_OPTIONS, style: mode === "count" ? "compact" : mode === "wings" ? "wings" : "status" }}
            model={null}
            count={count}
            icon={icon}
            onOpen={() => opened.push(sessionKey(active))}
          />
        )}
      </AgentNoticeStack>
    </div>
  );
}

const THREE = [SESSIONS.needs, SESSIONS.failed, SESSIONS.working];
const MODES: StackMode[] = ["peek", "count", "wings"];

function Fixture() {
  return (
    <>
      {MODES.map((mode) => <Stack key={mode} mode={mode} sessions={THREE} />)}
      <Stack mode="peek" sessions={[SESSIONS.done]} />
    </>
  );
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const frame = (id: string) => document.getElementById(id)!;
const titleOf = (root: Element) => root.querySelector(".agent-notice__title")?.textContent ?? "";
const rows = (root: Element) => [...root.querySelectorAll<HTMLButtonElement>(".agent-notice-stack__row")];
const press = (element: Element) => act(async () => { (element as HTMLElement).click(); });
const leave = (element: Element) => act(async () => { element.dispatchEvent(new PointerEvent("pointerout", { bubbles: true })); element.dispatchEvent(new PointerEvent("pointerleave")); });
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    const peek = frame("stack-peek-3");
    check(titleOf(peek) === SESSIONS.needs.title, "叠放露边：最紧急的（等你确认）在最前");
    check(peek.querySelectorAll(".agent-notice-stack__sliver").length === 2, "叠放露边：后面露出两条边");
    check(peek.querySelector(".agent-notice-stack__sliver.agent-notice-stack--tone-failed"), "露出的边带着后面那条的状态色");
    check(peek.querySelector(".agent-notice__count")?.textContent === "1/3", "叠放露边：卡片上写着 1/3");
    check(!peek.querySelector(".agent-notice-stack__list"), "平时不展开列表");
    await press(peek.querySelector(".agent-notice-stack__slivers")!);
    const list = await until(() => peek.querySelector(".agent-notice-stack__list"));
    check(list && rows(peek).length === 3 && !peek.querySelector(".agent-notice-stack__slivers"), "点露出的边展开成三行的列表，露边收起");
    check(rows(peek)[0].getAttribute("aria-current") === "true" && rows(peek)[0].textContent?.includes("等你确认"), "列表第一行是正在显示的那条");
    await press(rows(peek)[1]);
    check(titleOf(peek) === SESSIONS.failed.title, "点列表的一行，卡片换到那条");
    check(!peek.querySelector(".agent-notice-stack__list") && peek.querySelector(".agent-notice__count")?.textContent === "2/3", "换完列表收起，计数变成 2/3");
    await press(peek.querySelector(".agent-notice-stack__slivers")!);
    await until(() => peek.querySelector(".agent-notice-stack__list"));
    await leave(peek.querySelector(".agent-notice-stack")!);
    check(!peek.querySelector(".agent-notice-stack__list"), "鼠标移开叠放，列表收起");
    check(opened.length === 0, "点露出的边和列表都不触发卡片本身的跳转");

    const count = frame("stack-count-3");
    check(count.querySelector(".agent-notice__count")?.textContent === "+2" && !count.querySelector(".agent-notice-stack__slivers"), "一次一条：卡片上是 +2，不露边");
    await press(count.querySelector(".agent-notice__count")!);
    check(rows(count).length === 3 && opened.length === 0, "点 +2 下拉出列表，不触发卡片跳转");
    await press(rows(count)[2]);
    check(titleOf(count) === SESSIONS.working.title, "一次一条：点一行换到那条");

    const wings = frame("stack-wings-3");
    check(!wings.querySelector(".agent-notice-stack__slivers") && !wings.querySelector(".agent-notice__count"), "左翼图标堆：不露边、不出计数");
    const pile = wings.querySelector<HTMLButtonElement>(".agent-notice__band .agent-notice-stack__pile");
    check(pile && pile.querySelectorAll(".agent-provider-icon").length === 3 && !wings.querySelector(".agent-notice__band > .agent-notice__icon"), "左翼图标堆：卡片左上换成三个带状态环的图标");
    check(pile!.querySelector(".agent-notice-stack--tone-needs") === pile!.firstElementChild, "图标堆第一个是正在显示的那条");
    await press(pile!);
    check(rows(wings).length === 3 && opened.length === 0, "点图标堆展开成列表，不触发卡片跳转");
    await press(rows(wings)[1]);
    check(titleOf(wings) === SESSIONS.failed.title && !wings.querySelector(".agent-notice-stack__list"), "左翼图标堆：点一行换到那条，列表收起");

    const single = frame("stack-peek-1");
    check(!single.querySelector(".agent-notice-stack__slivers, .agent-notice__count, .agent-notice-stack__pile"), "只有一个会话时不叠、不计数");
    for (const thumb of document.querySelectorAll<HTMLElement>(".agent-notice-message__thumb")) thumb.removeAttribute("style");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

await act(async () => { createRoot(document.getElementById("fixture")!).render(<StrictMode><Fixture /></StrictMode>); });
if (automated) await runChecks();
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "演示：三种叠法（叠放露边、一次一条加 +n、左翼图标堆）和单个会话。加 ?test=1 运行检查。";
}
