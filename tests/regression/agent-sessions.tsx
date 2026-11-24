import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/features/agent-status/islandLayout";
import { checkNarrow, renderShowcase } from "./agent-sessions-showcase";
import { checkUsage } from "./agent-sessions-usage";
import { checkUsageViewAndEmpty } from "./agent-sessions-empty";
import { checkSubagentCards, checkSubagents } from "./agent-sessions-subagents";
import { checkChildSessions } from "./agent-sessions-children";
import { checkExpandByDefault } from "./agent-sessions-expand";
import { checkAgeColumns, renderAgeColumns } from "./agent-sessions-age";
import { until } from "./pollUntil";
import type { AgentCardEffects, AgentHostDisplay, AgentSessionView } from "../../src/features/agent-status/agentSettings";

const ISLAND_CHROME_HEIGHT = 86;
const fixture = document.getElementById("fixture")!;
const sizeFor = (rows: number) => { fixture.style.height = `${getAgentPageExpandedHeight(rows) - ISLAND_CHROME_HEIGHT}px`; };

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const params = new URLSearchParams(location.search);
const now = Date.now();
const focusCalls: Array<Record<string, unknown>> = [];
mockIPC((command, payload) => {
  if (command === "focus_agent_window") {
    const args = (payload ?? {}) as Record<string, unknown>;
    focusCalls.push(args);
    return args.cwd === "E:\\Projects\\fuyu";
  }
  if (command === "get_agent_hooks_state") return { claudeCode: "current", codex: "outdated", cursor: "absent", scriptsOutdated: false };
  if (command === "list_agent_effort_labels") return { claudeCode: { medium: "xhigh", high: "max" } };
  if (command === "get_agent_host_icon") {
    return `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#2b2f3a"/><path d="M4 5l3 3-3 3M8.5 11H12" stroke="#7ee787" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>')}`;
  }
  if (command === "get_agent_usage") {
    return {
      updatedAt: now, plan: "Max 20x",
      fiveHour: { name: "", used: 27, resetsAt: now + 3 * 3_600_000 },
      sevenDay: { name: "", used: 62, resetsAt: now + 5 * 86_400_000 },
      models: [{ name: "Fable", used: 100, resetsAt: now + (34 * 60 + 10) * 60_000 }],
    };
  }
});

const SESSIONS: AgentSessionSummary[] = [
  {
    provider: "claudeCode", sessionId: "a", cwd: "E:\\Projects\\fuyu", title: "设置界面完善思路",
    model: "Opus 5.5", effort: "medium", phase: "running", updatedAt: now - 20_000, turnStartedAt: now - 200_000,
    permissionMode: "bypass", subagents: 2,
    host: { name: "Orca", exe: "C:\\Apps\\orca\\Orca.exe", kind: "terminal" },
    lastMessage: "24 个测试全部通过。接下来用真实数据看看列表的实际效果和耗时，再决定要不要给第一句提问加缓存，顺便检查一下项目名是不是会话开始时的目录…",
  },
  {
    provider: "codex", sessionId: "b", cwd: "E:\\Projects\\MioPicFlow", title: "恢复 Windows 发布机环境，顺便把代理配置也整理一遍",
    model: "gpt-6-astra", effort: "high", phase: "waiting", updatedAt: now - 14 * 60_000, turnStartedAt: null, permissionMode: "default",
    host: { name: "Codex", exe: null, kind: "app" },
    lastMessage: "关闭系统代理后国内网站立即恢复，说明问题集中在 Clash 的代理链路。",
  },
  {
    provider: "claudeCode", sessionId: "c", cwd: "E:\\Projects\\TixXinBlog", title: "Nexus 紧凑视口密度变量",
    model: "Opus 5.5", effort: null, phase: "completed", permissionMode: "auto", subagents: 1, updatedAt: now - 95 * 60_000, lastMessage: null, host: null, turnStartedAt: now - 95 * 60_000 - 252_000,
  },
];

fixture.style.height = `${getAgentPageExpandedHeight(Number(params.get("rows")) || 3, 0, (params.get("view") as AgentSessionView | null) ?? "focused") - ISLAND_CHROME_HEIGHT}px`;
const root = createRoot(fixture);
const sessions = params.has("empty") ? [] : SESSIONS;
const render = async (hostDisplay: AgentHostDisplay, extra: { view?: AgentSessionView; showElapsed?: boolean; showModel?: boolean; cardEffects?: AgentCardEffects } = {}) => {
  await act(async () => {
    root.render(
      <StrictMode>
        <I18nProvider>
          <AgentSessionsPanel
            sort="recent"
            sessions={sessions}
            hostDisplay={hostDisplay}
            view={extra.view ?? (params.get("view") as AgentSessionView | null) ?? "focused"}
            cardEffects={extra.cardEffects ?? (params.get("effects") as AgentCardEffects | null) ?? "off"}
            showElapsed={extra.showElapsed}
            showModel={extra.showModel}
          />
        </I18nProvider>
      </StrictMode>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};
await render((params.get("host") as AgentHostDisplay | null) ?? "both");

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const rows = () => [...document.querySelectorAll<HTMLButtonElement>(".agent-sessions__list > li:not(.agent-motion-ghost) .agent-session")];
const results = document.getElementById("results")!;

async function runChecks() {
  try {
    check(document.querySelector(".agent-sessions")?.getAttribute("data-view") === "focused", "默认使用 A（分层聚焦）布局");
    check(rows().length === 3, "列出全部会话");
    const [first, second, third] = rows();
    check(first.querySelector(".agent-v__proj")?.textContent === "fuyu" && first.querySelector(".agent-v__title")?.textContent === "设置界面完善思路" && first.querySelector(".agent-provider-icon--claudeCode"), "分层聚焦行将项目标签、标题与来源图标分离");
    const modelText = (row: HTMLElement) => [...row.querySelectorAll(".agent-v__model > *")].map((part) => part.textContent).join(" · ");
    check(modelText(first) === "Opus 5.5 · XH · 跳过确认" && first.querySelector(".agent-v__model")?.getAttribute("title") === "Opus 5.5 · Xhigh · 跳过确认", `模型、推理强度、权限整合为行内弱化文本并保留完整悬停提示：${modelText(first)}`);
    check(modelText(second) === "gpt-6-astra · H", "插件只改了 Claude Code 的强度时，Codex 照原样显示");
    check(first.classList.contains("agent-focused__row--active") && second.classList.contains("agent-focused__row--active") && third.classList.contains("agent-focused__row--done"), "活跃会话用聚焦轻卡，已完成收纳到静默单行区");
    const dot = (row: HTMLElement) => getComputedStyle(row.querySelector(".agent-session__dot")!).backgroundColor;
    check(dot(first) === "rgb(52, 199, 89)" && dot(second) === "rgb(255, 69, 58)" && dot(third) === "rgb(142, 142, 147)", "运行绿、等你确认红、完成灰");
    const dotEl = (row: HTMLElement) => row.querySelector(".agent-session__dot")!;
    check(dotEl(first).getAttribute("aria-label") === "运行中" && dotEl(second).getAttribute("aria-label") === "等你确认" && dotEl(third).getAttribute("aria-label") === "已完成", "状态灯具备悬停和读屏说明");

    const filterTabs = [...document.querySelectorAll<HTMLButtonElement>(".agent-v__tab")];
    check(filterTabs.length === 4, "顶栏提供全部 / 需处理 / 运行中 / 已完成四个筛选标签");
    await act(async () => { filterTabs[1].click(); });
    check(rows().length === 1 && rows()[0].textContent?.includes("MioPicFlow"), "点「需处理」只显示等待确认的会话");
    await act(async () => { filterTabs[3].click(); });
    check(rows().length === 1 && rows()[0].textContent?.includes("Nexus"), "点「已完成」只显示已完成会话");
    await act(async () => { filterTabs[0].click(); });
    check(rows().length === 3, "点「全部」恢复全部会话");

    const collapseDone = document.querySelector<HTMLButtonElement>(".agent-focused__toggle")!;
    await act(async () => { collapseDone.click(); });
    check(rows().length === 2, "最近完成区可以一键折叠");
    await act(async () => { collapseDone.click(); });
    check(rows().length === 3, "再点一次展开最近完成区");

    const seenKeys: string[] = [];
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" unseen={{ keys: new Set(["claudeCode:c"]), markSeen: (session) => seenKeys.push(session.sessionId) }} /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    check(rows()[2].classList.contains("agent-session--unseen") && !rows()[0].classList.contains("agent-session--unseen"), "刚完成未读的会话保持未读高亮");
    rows()[0].click();
    check(seenKeys.join() === "a", "点开会话记为已看");

    const removedIds: string[] = [];
    let undone = 0;
    const renderRemoval = async (removed: AgentSessionSummary | null) => {
      await act(async () => {
        root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both"
          removal={{ remove: (session) => removedIds.push(session.sessionId), removed, undo: () => { undone += 1; } }} /></I18nProvider></StrictMode>);
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    };
    await renderRemoval(null);
    const removeButtons = [...document.querySelectorAll<HTMLButtonElement>(".agent-session__archive")];
    check(removeButtons.length === 3 && removeButtons[0].getAttribute("aria-label") === "归档「设置界面完善思路」", "每行支持归档并带读屏文案");
    const focusesBefore = focusCalls.length;
    removeButtons[2].click();
    check(removedIds.length === 0, "点归档先播移出动画再移除");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    check(removedIds.join() === "c" && focusCalls.length === focusesBefore, "归档不触发窗口跳转");
    await renderRemoval(sessions[2]);
    const notice = document.querySelector<HTMLElement>(".agent-archived");
    check(notice?.textContent?.includes("已归档"), "归档后浮出撤销胶囊");
    notice!.querySelector("button")!.click();
    check(undone === 1, "点撤销恢复会话");
    await renderRemoval(null);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });

    await render("both");
    const panel = document.querySelector<HTMLElement>(".agent-sessions")!;
    check(panel.scrollWidth <= panel.clientWidth, "面板无横向溢出");
    const beforeElapsed = rows()[0].querySelector(".agent-session__elapsed")?.textContent;
    await until(() => rows()[0].querySelector(".agent-session__elapsed")?.textContent !== beforeElapsed);
    check(rows()[0].querySelector(".agent-session__elapsed")?.textContent !== beforeElapsed, "进行中的会话时长每秒更新");

    await render("both", { showElapsed: false, showModel: false });
    check(!document.querySelector(".agent-session__elapsed") && !document.querySelector(".agent-v__model-name"), "可关闭运行时长和模型");

    const withActivity: AgentSessionSummary[] = [
      { ...SESSIONS[0], lastPrompt: "发个补丁版", currentTool: { name: "Bash", detail: "git push origin main && gh run watch --exit-status" } },
      { ...SESSIONS[1], lastPrompt: "恢复发布机环境" },
      SESSIONS[2],
    ];
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={withActivity} hostDisplay="both" showActivity /></I18nProvider></StrictMode>);
    });
    check(rows()[0].querySelector(".agent-v__verb")?.textContent === "Bash" && rows()[0].querySelector(".agent-session__tool-detail")?.textContent?.startsWith("git push"), "运行中的会话在第二行显示工具名和等宽参数");

    await render("both", { view: "split" });
    check(document.querySelector(".agent-view--split") && document.querySelector(".agent-split__detail")?.textContent?.includes("设置界面完善思路"), "B（双栏工作台）：左栏索引 + 右栏实时详情");
    const splitItems = [...document.querySelectorAll<HTMLButtonElement>(".agent-split__item")];
    await act(async () => { splitItems[1].click(); });
    check(document.querySelector(".agent-split__detail")?.textContent?.includes("恢复 Windows 发布机环境"), "B（双栏工作台）：点击左栏立即切换右栏详情");

    await render("both", { view: "bento", cardEffects: "sparkle" });
    check(document.querySelector(".agent-bento__spotlight") && document.querySelectorAll(".agent-bento__card").length === 1 && document.querySelectorAll(".agent-bento__done").length === 1, "C（双列卡片）：紧急项横跨置顶，运行中卡片与已完成双列排布");
    check(document.querySelectorAll(".agent-card--sparkle > .agent-card__band").length >= 2, "C（双列卡片）：支持粒子流苏光效");

    await render("both", { view: "projects" });
    check(document.querySelectorAll(".agent-projects__head").length === 3, "D（项目指挥台）：按项目文件夹收纳分组");

    await render("both", { view: "minimal", cardEffects: "orbit" });
    check(document.querySelector(".agent-minimal__footer") && document.querySelectorAll(".agent-session--orbit > .agent-orbit-ring").length === 1, "E（极简清单）：带底部路径/按键栏并支持等你确认的流光边框");

    await checkUsage({ root, fixture, sessions, check, chromeHeight: ISLAND_CHROME_HEIGHT });
    await checkUsageViewAndEmpty({ root, sessions, check });
    await checkSubagents({ root, fixture, sessions, check, chromeHeight: ISLAND_CHROME_HEIGHT });
    await checkChildSessions({ root, fixture, sessions, check, chromeHeight: ISLAND_CHROME_HEIGHT });
    await checkExpandByDefault({ root, fixture, sessions, check, chromeHeight: ISLAND_CHROME_HEIGHT });
    await checkAgeColumns({ root, fixture, sessions, chromeHeight: ISLAND_CHROME_HEIGHT }, check);
    await checkSubagentCards({ root, sessions, check });
    await checkNarrow({ root, fixture, sessions, chromeHeight: ISLAND_CHROME_HEIGHT }, check);

    sizeFor(3);
    await render("both");
    await act(async () => { rows()[0].click(); await Promise.resolve(); });
    const lastCall = focusCalls[focusCalls.length - 1];
    check(lastCall?.provider === "claudeCode" && lastCall?.title === "设置界面完善思路", "点击会话按项目和标题查找窗口");
    await act(async () => { rows()[1].click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
    check(rows()[1].querySelector(".agent-session__not-found")?.textContent === "没找到对应的窗口", "找不到窗口时在该行提示");

    await renderShowcase({ root, fixture, sessions, chromeHeight: ISLAND_CHROME_HEIGHT });
    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
    console.error(error);
  }
}

if (params.has("test")) await runChecks();
else if (params.has("showcase")) await renderShowcase({ root, fixture, sessions, chromeHeight: ISLAND_CHROME_HEIGHT });
else if (params.has("age")) await renderAgeColumns({ root, fixture, sessions, chromeHeight: ISLAND_CHROME_HEIGHT });
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "点击会话查看跳转结果：只有 fuyu 会话能找到窗口。";
}
