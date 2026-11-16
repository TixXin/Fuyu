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
import { checkSubagents } from "./agent-sessions-subagents";
import { checkChildSessions } from "./agent-sessions-children";
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
    return args.cwd === "E:\\Projects\\fly-island";
  }
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
    provider: "claudeCode", sessionId: "a", cwd: "E:\\Projects\\fly-island", title: "设置界面完善思路",
    model: "Opus 5.5", effort: "medium", phase: "running", updatedAt: now - 20_000, turnStartedAt: now - 200_000,
    permissionMode: "bypass", subagents: 2,
    host: { name: "Orca", exe: "C:\\Apps\\orca\\Orca.exe", kind: "terminal" },
    lastMessage: "24 个测试全部通过。接下来用真实数据看看列表的实际效果和耗时，再决定要不要给第一句提问加缓存，顺便检查一下项目名是不是会话开始时的目录，以及跳转窗口时能不能按项目文件夹找到对应的编辑器窗口和终端窗口…",
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

fixture.style.height = `${getAgentPageExpandedHeight(Number(params.get("rows")) || 3, 0, (params.get("view") as AgentSessionView | null) ?? "list") - ISLAND_CHROME_HEIGHT}px`;
const root = createRoot(fixture);
const sessions = params.has("empty") ? [] : SESSIONS;
const render = async (hostDisplay: AgentHostDisplay, cards: { showElapsed?: boolean; showModel?: boolean } = {}) => {
  await act(async () => {
    root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay={hostDisplay} view={(params.get("view") as AgentSessionView | null) ?? "list"} cardEffects={(params.get("effects") as AgentCardEffects | null) ?? "off"} {...cards} /></I18nProvider></StrictMode>);
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
    check(rows().length === 3, "列出全部会话");
    const [first, second, third] = rows();
    check(first.textContent?.includes("fly-island · 设置界面完善思路") && first.querySelector(".agent-provider-icon--claudeCode"), "每行显示图标、项目名和标题");
    const pill = (row: HTMLElement) => [...row.querySelectorAll(".agent-session__pill > *")].map((part) => part.textContent).join(" · ");
    check(pill(first) === "Opus 5.5 · XH · 跳过确认" && first.querySelector(".agent-session__pill")?.getAttribute("title") === "Opus 5.5 · Xhigh · 跳过确认", `模型、推理强度、权限合成一个胶囊，强度缩写，悬停看全称：${pill(first)}`);
    check(pill(second) === "gpt-6-astra · H", "插件只改了 Claude Code 的强度时，Codex 照原样显示");
    check(first.classList.contains("agent-session--running") && second.classList.contains("agent-session--waiting") && third.classList.contains("agent-session--completed"), "状态灯按会话状态着色");
    const meta = (row: HTMLElement) => row.querySelector(".agent-session__meta")?.textContent;
    const time = (row: HTMLElement) => row.querySelector(".agent-session__time")?.textContent;
    const dot = (row: HTMLElement) => getComputedStyle(row.querySelector(".agent-session__dot")!).backgroundColor;
    check(meta(second) === "等待确认" && time(second) === "14m" && dot(second) === "rgb(255, 69, 58)", "卡住等你的会话显示红色状态灯和状态文字，时间单独一列");
    const dotLabel = (row: HTMLElement) => row.querySelector(".agent-session__dot")!;
    check(dotLabel(first).getAttribute("aria-label") === "运行中" && dotLabel(first).getAttribute("title") === "运行中" && dotLabel(second).getAttribute("aria-label") === "等你确认"
      && dotLabel(third).getAttribute("aria-label") === "已完成" && dotLabel(first).getAttribute("role") === "img", "状态灯有悬停说明和读屏文字，说的是灯色的含义");
    check(dot(first) === "rgb(52, 199, 89)" && dot(third) === "rgb(142, 142, 147)", "在跑的会话绿色，做完的灰色");
    check(meta(first)?.startsWith("已运行 3 分 2") && !meta(first)?.includes("<1m") && time(third) === "1h" && !meta(third)?.includes("1h"), "运行中的会话显示已运行多久，结束的在时间列显示多久前更新");
    check(first.classList.contains("agent-session--full") && second.classList.contains("agent-session--full") && third.classList.contains("agent-session--compact"), "进行中的会话展开，已完成的折叠成一行");
    check(rows().every((row) => row.firstElementChild?.classList.contains("agent-session__dot") && row.querySelector(".agent-session__heading .agent-provider-icon") && row.querySelectorAll(".agent-session__dot").length === 1), "每行都以状态灯开头，图标都在标题行右侧");
    const title = second.querySelector<HTMLElement>(".agent-session__title")!;
    const message = first.querySelector<HTMLElement>(".agent-session__message")!;
    check(title.scrollWidth > title.clientWidth, "长标题单行省略");
    check(message.scrollHeight > message.clientHeight && message.clientHeight < 40, "最新回复最多两行");
    check(!third.querySelector(".agent-session__message") && !third.querySelector(".agent-session__pill"), "折叠行不显示回复和模型");
    check(first.querySelector(".agent-session__pill-mode--bypass")?.textContent === "跳过确认" && meta(first)?.includes("2 个子 Agent"), "运行中的会话标出跳过确认的权限模式和正在跑的子 Agent 数");
    check(!second.querySelector(".agent-session__pill-mode") && !third.querySelector(".agent-session__pill-mode") && !meta(third)?.includes("子 Agent"), "默认权限模式和已结束的会话不显示这两项");
    const titleTone = (row: HTMLElement) => getComputedStyle(row.querySelector(".agent-session__title")!).color;
    const dimTitle = titleTone(third);
    const seenKeys: string[] = [];
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} hostDisplay="both" unseen={{ keys: new Set(["claudeCode:c"]), markSeen: (session) => seenKeys.push(session.sessionId) }} /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    check(third.classList.contains("agent-session--unseen") && titleTone(third) === titleTone(first) && titleTone(third) !== dimTitle && !first.classList.contains("agent-session--unseen"), "跑完还没看的会话标题保持亮色，看过的才变灰");
    first.click();
    check(seenKeys.join() === "a", "点开会话就算看过");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 300)); });
    const lookedSessions = rows();
    check(lookedSessions[1].classList.contains("agent-session--looked") && meta(lookedSessions[1])?.startsWith("等待确认")
      && getComputedStyle(lookedSessions[1].querySelector(".agent-session__dot")!).boxShadow === "none"
      && !lookedSessions[2].classList.contains("agent-session--looked"),
      "看过的等待确认会话仍写状态，但状态灯不再亮");
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
    const firstRow = rows()[0].getBoundingClientRect();
    const firstRemove = removeButtons[0].getBoundingClientRect();
    const providerIcon = rows()[0].querySelector(".agent-session__heading > :last-child")!.getBoundingClientRect();
    const archiveIcon = removeButtons[0].querySelector("svg")!.getBoundingClientRect();
    check(removeButtons.length === 3 && getComputedStyle(removeButtons[0]).opacity === "1"
      && firstRemove.left >= providerIcon.right && firstRemove.right <= firstRow.right && firstRemove.width <= 20
      && Math.abs(fixture.getBoundingClientRect().right + 20 - archiveIcon.right - 20) < 1,
      "归档按钮一直显示在提供方图标右边，图标离岛屿边缘 20px，和顶部按钮对齐");
    check(removeButtons[0].getAttribute("aria-label") === "归档「设置界面完善思路」", "归档按钮的读屏文字说明归档哪个会话");
    const agedItem = rows()[2].closest("li")!;
    const age = agedItem.querySelector<HTMLElement>(".agent-session__age");
    const agedArchive = agedItem.querySelector<HTMLButtonElement>(".agent-session__archive")!;
    check(age?.textContent === "1h" && !meta(rows()[2])?.includes("1h") && !rows()[0].closest("li")!.querySelector(".agent-session__age")
      && getComputedStyle(agedArchive).opacity === "0" && getComputedStyle(age).opacity === "1"
      && Math.abs(age.getBoundingClientRect().right - agedArchive.querySelector("svg")!.getBoundingClientRect().right) < 1,
      "平时归档按钮的位置显示多久前更新，右边和归档图标对齐；运行中没有时间的行照常显示归档按钮");
    const agedIcon = rows()[2].querySelector(".agent-session__heading > :last-child")!.getBoundingClientRect();
    const firstIcon = rows()[0].querySelector(".agent-session__heading > :last-child")!.getBoundingClientRect();
    const slotGap = age!.getBoundingClientRect().left - agedIcon.right;
    check(slotGap >= 0 && slotGap <= 12 && Math.abs(agedIcon.right - firstIcon.right) < 0.5, "时间那一列按最长的时间定宽，和左边的 Agent 图标不空出一大截，各行图标仍在同一列");
    agedArchive.focus();
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 200)); });
    check(getComputedStyle(agedArchive).opacity === "1" && getComputedStyle(age!).opacity === "0", "鼠标移上或用键盘选到这一行时，时间换成归档按钮");
    agedArchive.blur();
    const focusesBefore = focusCalls.length;
    removeButtons[2].click();
    check(removedIds.length === 0, "点归档后，行先播完移出动画才离开列表");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    check(removedIds.join() === "c" && focusCalls.length === focusesBefore, "动画播完只归档这个会话，不去切换窗口");
    await renderRemoval(sessions[2]);
    const notice = document.querySelector<HTMLElement>(".agent-archived");
    const panelBox = document.querySelector<HTMLElement>(".agent-sessions")!.getBoundingClientRect();
    check(notice?.textContent?.includes("已归档") && notice.getAttribute("role") === "status"
      && getComputedStyle(notice).position === "absolute" && notice.getBoundingClientRect().left - panelBox.left < 12
      && notice.getBoundingClientRect().width < panelBox.width / 2,
      "归档后左下角浮出「已归档 · 撤销」小胶囊，不占列表的位置");
    notice!.querySelector("button")!.click();
    check(undone === 1, "点撤销把会话放回去");
    await renderRemoval(null);
    check(document.querySelector(".agent-archived--leaving"), "撤销或到时后胶囊先播移出动画");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
    check(!document.querySelector(".agent-archived"), "移出动画播完胶囊消失");
    await render("both");
    const panel = document.querySelector<HTMLElement>(".agent-sessions")!;
    check(panel.scrollWidth <= panel.clientWidth, "面板没有横向溢出");
    const list = document.querySelector<HTMLElement>(".agent-sessions__list")!;
    const rowHeights = rows().map((row) => row.getBoundingClientRect().height);
    check(rowHeights[0] === 78 && rowHeights[1] < rowHeights[0] - 10 && rowHeights[2] < rowHeights[1], "展开行随回复行数变高（两行 78px，一行更矮，不留空行），折叠行最矮");
    const font = (selector: string) => { const style = getComputedStyle(first.querySelector(selector)!); return `${style.fontSize} ${style.fontWeight}`; };
    check(font(".agent-session__title") === "14px 600" && font(".agent-session__message") === "13px 400" && font(".agent-session__meta") === "12px 400" && font(".agent-session__pill") === "11px 400", "字号字重：标题 14/600，回复 13/400，状态 12/400，模型胶囊 11/400");
    check(list.scrollHeight <= list.clientHeight, "设为 3 条时放下 3 个会话，不滚动");
    check(Math.abs(list.getBoundingClientRect().bottom - (fixture.getBoundingClientRect().bottom + 20)) < 1, "列表一直延伸到岛屿底边，底部不留空白条");
    const afterLayout = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    await afterLayout();
    const masked = () => getComputedStyle(list).maskImage !== "none";
    check(!list.dataset.fadeTop && !list.dataset.fadeBottom && !masked(), "放得下时两头都不渐隐");
    sizeFor(2);
    await afterLayout();
    check(list.scrollHeight > list.clientHeight, "设为 2 条时第 3 个会话需要滚动");
    check(list.dataset.fadeBottom !== undefined && list.dataset.fadeTop === undefined && masked(), "下面还有会话时底部渐隐，顶部不渐隐");
    list.scrollTop = list.scrollHeight;
    await afterLayout();
    check(list.dataset.fadeTop !== undefined && list.dataset.fadeBottom === undefined, "滚到底后顶部渐隐，底部不再渐隐");
    list.scrollTop = 0;
    sizeFor(5);
    await afterLayout();
    check(list.scrollHeight <= list.clientHeight, "设为 5 条时 3 个会话不滚动");
    sizeFor(3);

    const badge = (row: HTMLElement) => row.querySelector<HTMLImageElement>(".agent-session__agent > img.agent-session__host-badge");
    check(first.querySelector(".agent-session__host")?.textContent === "Orca" && badge(first)?.alt === "在 Orca 里运行" && badge(first)?.title === "在 Orca 里运行", "来源显示程序名，程序图标做成 Agent 图标右下角的角标，悬停说明在哪里运行");
    const order = (row: HTMLElement) => [...row.querySelector(".agent-session__heading")!.children].map((child) => child.className.split(" ")[0].replace("agent-session__", "")).join();
    check(order(second) === "title,pill,meta,host,agent,time" && order(first) === "title,pill,meta,host,agent" && first.querySelector(".agent-session__agent > .agent-provider-icon"), `标题行依次是标题、胶囊、状态、来源、Agent 图标、时间：${order(second)}`);
    check(!badge(second) && !second.querySelector("svg") && second.querySelector(".agent-session__host")?.textContent === "Codex", "取不到程序图标时不显示角标，不再用通用的方框图标");
    check(!third.querySelector(".agent-session__host") && !badge(third), "不知道来源时不显示");
    await render("icon");
    check(badge(first) && !first.querySelector(".agent-session__host-name") && !second.querySelector(".agent-session__host") && !badge(second), "只显示图标时只有角标，取不到图标的什么都不显示");
    await render("icon", { showElapsed: false });
    const iconRight = (row: HTMLElement) => row.querySelector(".agent-provider-icon")!.getBoundingClientRect().right;
    check(meta(first) === "2 个子 Agent" && time(first) === "1m" && !third.querySelector(".agent-session__meta") && time(third) === "1h"
      && Math.abs(iconRight(first) - iconRight(third)) < 0.5 && Math.abs(iconRight(first) - iconRight(second)) < 0.5, "时间长短不同、有无来源时，右侧图标仍在同一列");
    const dotGap = first.querySelector(".agent-session__dot")!.getBoundingClientRect().left - (fixture.getBoundingClientRect().left - 20);
    const timeBox = first.querySelector<HTMLElement>(".agent-session__time")!;
    const timeGap = fixture.getBoundingClientRect().right + 20 - timeBox.getBoundingClientRect().right;
    check(Math.abs(dotGap - 20) < 1 && Math.abs(timeGap - 20) < 1 && timeBox.scrollWidth <= timeBox.clientWidth, "圆点和时间列都距岛屿边缘 20px，时间不被截");
    await render("name");
    check(first.querySelector(".agent-session__host-name")?.textContent === "Orca" && !first.querySelector(".agent-session__host-icon") && !badge(first), "只显示名称");
    await render("off");
    check(!document.querySelector(".agent-session__host") && !document.querySelector(".agent-session__host-badge"), "设为不显示时隐藏来源");
    await render("both");
    check(meta(third) === "用时 4 分 12 秒" && time(third) === "1h", "结束的会话显示这一轮用时");
    check(!second.querySelector(".agent-session__elapsed"), "不知道这一轮何时开始时不显示时长");
    const before = first.querySelector(".agent-session__elapsed")?.textContent;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
    check(first.querySelector(".agent-session__elapsed")?.textContent !== before, "进行中的会话时长每秒更新");
    await render("both", { showElapsed: false, showModel: false });
    check(!document.querySelector(".agent-session__elapsed") && !document.querySelector(".agent-session__pill-model") && document.querySelector(".agent-session__pill-mode"), "可以关掉运行时长和模型，权限照常显示");
    await act(async () => {
      const turnJustStarted = [{ ...SESSIONS[0], lastMessage: null }, ...SESSIONS.slice(1)];
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={turnJustStarted} hostDisplay="both" /></I18nProvider></StrictMode>);
    });
    check(rows()[0].classList.contains("agent-session--compact") && rows()[0].querySelector(".agent-session__pill-model") && rows()[0].getBoundingClientRect().height < 40, "刚开始一轮、还没有回复的会话不留空白第二行");
    await render("both");
    await render("both");
    const titleColor = () => getComputedStyle(rows()[0].querySelector(".agent-session__title")!).color;
    check(titleColor() === "rgba(241, 240, 246, 0.96)", "深色岛屿背景上标题是浅色字");
    fixture.style.setProperty("--island-ink-rgb", "24, 24, 30");
    check(titleColor() === "rgba(24, 24, 30, 0.96)", "浅色岛屿背景上标题换成深色字");
    fixture.style.removeProperty("--island-ink-rgb");

    const withActivity: AgentSessionSummary[] = [
      { ...SESSIONS[0], lastPrompt: "发个 0.5.3 补丁版并升级线上", currentTool: { name: "Bash", detail: "git push origin main && gh run watch --exit-status" } },
      { ...SESSIONS[1], lastPrompt: "恢复发布机环境" },
      SESSIONS[2],
    ];
    const renderActivity = async (showActivity: boolean) => {
      await act(async () => {
        root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={withActivity} hostDisplay="both" showActivity={showActivity} /></I18nProvider></StrictMode>);
      });
    };
    await renderActivity(true);
    const [running, waiting] = rows();
    check(running.querySelector(".agent-session__prompt")?.textContent === "你：发个 0.5.3 补丁版并升级线上"
      && running.querySelector(".agent-session__tool-name")?.textContent === "Bash"
      && running.querySelector(".agent-session__tool-detail")?.textContent?.startsWith("git push")
      && getComputedStyle(running.querySelector(".agent-session__tool-name")!).fontWeight === "600"
      && getComputedStyle(running.querySelector(".agent-session__tool-detail")!).fontFamily.includes("Mono")
      && running.querySelector(".agent-session__tool")?.getAttribute("title")?.startsWith("正在调用 Bash")
      && !running.querySelector(".agent-session__message"), "运行中的会话显示最近提问和正在调用的工具");
    const reply = waiting.querySelector<HTMLElement>(".agent-session__message");
    check(waiting.querySelector(".agent-session__prompt") && reply && reply.clientHeight < 25 && !waiting.querySelector(".agent-session__tool"), "没有工具时提问下面接一行回复");
    check(running.getBoundingClientRect().height === 78 && waiting.getBoundingClientRect().height === 78, "提问加一行内容的行和两行回复一样高（78px）");
    await renderActivity(false);
    check(!document.querySelector(".agent-session__prompt") && !document.querySelector(".agent-session__tool") && rows()[0].querySelector(".agent-session__message"), "关掉后只显示回复");

    await checkUsage({ root, fixture, sessions, check, chromeHeight: ISLAND_CHROME_HEIGHT });
    await checkSubagents({ root, fixture, sessions, check, chromeHeight: ISLAND_CHROME_HEIGHT });
    await checkChildSessions({ root, fixture, sessions, check, chromeHeight: ISLAND_CHROME_HEIGHT });
    sizeFor(3);
    await render("both");

    await act(async () => { first.click(); await Promise.resolve(); });
    const lastCall = focusCalls[focusCalls.length - 1];
    check(lastCall?.provider === "claudeCode" && lastCall?.title === "设置界面完善思路", "点击会话按项目和标题查找窗口");
    check(typeof lastCall?.sessionId === "string" && lastCall.sessionId !== "", "点击会话时带上会话 ID，用来找它自己的窗口");
    check(!document.querySelector(".agent-session__not-found"), "找到窗口时不提示");
    await act(async () => { second.click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
    check(second.querySelector(".agent-session__not-found")?.textContent === "没找到对应的窗口", "找不到窗口时在该行提示");
    await act(async () => { third.click(); await new Promise((resolve) => setTimeout(resolve, 20)); });
    check(third.querySelector(".agent-session__not-found")?.textContent === "没找到对应的窗口，会话可能已经关掉了", "已结束的会话找不到窗口时说明可能已关掉");

    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={[{ ...SESSIONS[2], sessionId: "d", replyAsks: true }]} hostDisplay="both" /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const asking = rows()[0];
    check(asking.classList.contains("agent-session--light-yourTurn") && dot(asking) === "rgb(255, 214, 10)" && meta(asking)?.startsWith("等你回复"),
      `回复以问句结尾的会话显示黄色状态灯和「等你回复」：${meta(asking)}`);
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={[{ ...SESSIONS[0], sessionId: "e", compacting: true }]} hostDisplay="both" /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const compacting = rows()[0];
    check(meta(compacting)?.startsWith("正在压缩上下文") && dot(compacting) === "rgb(52, 199, 89)", `压缩上下文时写明，状态灯仍是绿色：${meta(compacting)}`);
    await act(async () => {
      const planned = { ...SESSIONS[0], sessionId: "f", subagents: 0, backgroundTasks: 2, todos: { done: 2, total: 5, current: "正在写解析" } };
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={[planned]} hostDisplay="both" /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const planned = rows()[0];
    const todos = planned.querySelector<HTMLElement>(".agent-session__todos");
    check(
      todos?.textContent === "2/5 步" && todos.title === "正在：正在写解析" && meta(planned)?.includes("2 个后台任务") && planned.getBoundingClientRect().height < 90,
      `状态行显示任务清单进度和后台任务数，鼠标停上去看正在做的一步，行高不变：${meta(planned)}`,
    );
    const remote: AgentSessionSummary = {
      ...sessions[0], sessionId: "local-api/r-1", provider: "codex", cwd: "/srv/app", title: "服务器上的会话",
      host: { name: "dev-box", exe: null, kind: "remote" }, remoteHost: "dev-box",
    };
    await act(async () => {
      root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={[remote]} hostDisplay="both" /></I18nProvider></StrictMode>);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    check(rows()[0].querySelector(".agent-session__host")?.textContent === "dev-box" && !rows()[0].querySelector(".agent-session__host-badge"), "远程会话显示主机名，没有程序图标时不加角标");
    const remoteFocuses = focusCalls.length;
    await act(async () => rows()[0].click());
    const remoteCall = focusCalls[remoteFocuses];
    check(focusCalls.length === remoteFocuses + 1 && remoteCall?.sessionId === "" && remoteCall?.cwd === "/srv/app" && remoteCall?.title === "服务器上的会话",
      "点远程会话按标题和文件夹找连着服务器的本地窗口，不带会话 ID");
    check(rows()[0].querySelector(".agent-session__not-found")?.textContent === "没找到连着 dev-box 的终端或编辑器窗口", "找不到时说明没有连着那台机器的窗口");
    const renderView = async (view: AgentSessionView) => {
      fixture.style.height = `${getAgentPageExpandedHeight(3, 0, view) - ISLAND_CHROME_HEIGHT}px`;
      await act(async () => {
        root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={[{ ...SESSIONS[0], contextTokens: 86_400 }, ...SESSIONS.slice(1)]} view={view} hostDisplay="both"
          removal={{ remove: () => undefined, removed: null, undo: () => undefined }} /></I18nProvider></StrictMode>);
        await new Promise((resolve) => setTimeout(resolve, 300));
      });
      return [...document.querySelectorAll<HTMLButtonElement>(".agent-sessions__list > li:not(.agent-motion-ghost) .agent-card")];
    };
    const fits = () => { const list = document.querySelector<HTMLElement>(".agent-sessions__list")!; return list.scrollHeight <= list.clientHeight + 1; };
    let cards = await renderView("cards");
    check(cards.length === 3 && cards.every((card) => card.offsetHeight === 62) && fits(), "卡片视图每个会话一张 62px 的卡片，三张正好放下");
    check(cards[0].querySelector(".agent-card__tokens")?.textContent === "86.4k tokens" && !cards[2].querySelector(".agent-card__tokens"), "卡片右下写上下文大小，不知道时不写");
    check(cards.every((card) => card.closest("li")?.querySelector(".agent-session__archive")), "卡片视图照样能归档");
    cards = await renderView("compact");
    check(cards.length === 3 && cards.every((card) => card.offsetHeight === 34 && !card.querySelector(".agent-card__status-line") && card.querySelector(".agent-card__bar")) && fits(),
      "紧凑视图每个会话一行 34px，只有色条、标题、状态和时间");
    const dissolved: string[] = [];
    await act(async () => root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} view="cards" archiveMotion="dissolve" hostDisplay="both"
      removal={{ remove: (session) => dissolved.push(session.sessionId), removed: null, undo: () => undefined }} /></I18nProvider></StrictMode>));
    await act(async () => document.querySelector<HTMLButtonElement>(".agent-session__archive")!.click());
    check(document.querySelector(".agent-dissolving > .agent-dissolve__dust") && dissolved.length === 0, "选了粒子消散时，归档的卡片先化成粒子，还没从列表移除");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 800)); });
    check(dissolved.join() === "a", "粒子散完、收起后才移除这个会话");
    await act(async () => root.render(<StrictMode><I18nProvider><AgentSessionsPanel sort="recent" sessions={sessions} view="cards" cardEffects="sparkle" hostDisplay="both" /></I18nProvider></StrictMode>));
    check(document.querySelectorAll(".agent-card--sparkle > .agent-card__band").length === 3
      && [...document.querySelectorAll<HTMLElement>(".agent-card--sparkle")].every((card) => card.offsetHeight === 62),"粒子流苏给每张卡片加一条流苏，不改变卡片高度");
    await checkNarrow({ root, fixture, sessions, chromeHeight: ISLAND_CHROME_HEIGHT }, check);
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
else {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  results.textContent = "点击会话查看跳转结果：只有 fly-island 会话能找到窗口。";
}
