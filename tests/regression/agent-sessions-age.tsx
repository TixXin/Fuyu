import { act, StrictMode } from "react";
import type { Root } from "react-dom/client";
import { I18nProvider } from "../../src/i18n";
import { AgentSessionsPanel } from "../../src/features/agent-status/AgentSessionsPanel";
import type { AgentSessionSummary } from "../../src/features/agent-status/api";
import { getAgentPageExpandedHeight } from "../../src/features/agent-status/islandLayout";

type Context = { root: Root; fixture: HTMLElement; sessions: AgentSessionSummary[]; chromeHeight: number };
type Check = (condition: unknown, label: string) => void;

const AGES = [["1m", 1], ["24m", 24], ["1h", 60], ["10d", 10 * 24 * 60]] as const;

function ageSessions(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  const now = Date.now();
  const done = sessions[2];
  return [
    { ...sessions[0], sessionId: "age-running", lastMessage: null, updatedAt: now - 5_000, turnStartedAt: now - 200_000 },
    ...AGES.map(([label, minutes], index) => ({ ...done, sessionId: `age-${label}`, title: `更新于 ${label} 前`, subagents: 0, turnStartedAt: null, updatedAt: now - minutes * 60_000 - 5_000 - index })),
  ];
}

export async function renderAgeColumns({ root, fixture, sessions, chromeHeight }: Context) {
  const height = getAgentPageExpandedHeight(5) - chromeHeight;
  fixture.style.height = "auto";
  const removal = { remove: () => undefined, removed: null, undo: () => undefined };
  await act(async () => {
    root.render(
      <StrictMode>
        <I18nProvider>
          <div data-age-list="plain" style={{ height, marginBottom: 24 }}><AgentSessionsPanel sort="recent" sessions={ageSessions(sessions)} hostDisplay="icon" /></div>
          <div data-age-list="archivable" style={{ height }}><AgentSessionsPanel sort="recent" sessions={ageSessions(sessions)} hostDisplay="icon" removal={removal} /></div>
        </I18nProvider>
      </StrictMode>,
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

function probeWidth(host: HTMLElement, text: string) {
  const probe = document.createElement("span");
  probe.className = "agent-session__age";
  probe.textContent = text;
  host.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

export async function checkAgeColumns(context: Context, check: Check) {
  await renderAgeColumns(context);
  for (const kind of ["plain", "archivable"] as const) {
    const list = document.querySelector<HTMLElement>(`[data-age-list="${kind}"]`)!;
    const rows = [...list.querySelectorAll<HTMLElement>(".agent-sessions__list > li:not(.agent-motion-ghost) .agent-session")];
    const rect = (row: HTMLElement, selector: string) => row.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
    const boxes = rows.map((row) => rect(row, ".agent-session__time")!);
    const icons = rows.map((row) => rect(row, ".agent-provider-icon")!);
    const aged = rows.filter((row) => row.querySelector(".agent-session__age"));
    const texts = aged.map((row) => rect(row, ".agent-session__age")!);
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
    const label = kind === "plain" ? "不可归档的列表" : "可归档的列表";
    check(rows.length === 5 && aged.map((row) => row.querySelector(".agent-session__age")!.textContent).join() === AGES.map(([text]) => text).join(),
      `${label}：四行时间依次是 1m、24m、1h、10d，运行中计时的那行不显示时间`);
    const timeBox = rows[0].querySelector<HTMLElement>(".agent-session__time")!;
    const widest = probeWidth(timeBox, "99m");
    check(spread(boxes.map((box) => box.width)) < 0.5 && Math.abs(boxes[0].width - widest) < 0.5,
      `${label}：每行的时间盒一样宽，正好是「99m」的宽度（${boxes[0].width.toFixed(1)}px）`);
    check(spread(icons.map((icon) => icon.right)) < 0.5, `${label}：五行的 Agent 图标右边缘在同一列，包括运行中计时的那行`);
    check(spread(texts.map((text) => text.right)) < 0.5 && Math.abs(texts[0].right - boxes[0].right) < 0.5, `${label}：时间文字右对齐，右边缘在同一列`);
    const gaps = texts.map((text, index) => text.left - icons[index + 1].right);
    const charWidth = probeWidth(timeBox, "m");
    check(Math.min(...gaps) >= 4 && spread(gaps) <= charWidth + 0.5,
      `${label}：图标到时间文字的间距相差不超过一个字符（${gaps.map((gap) => gap.toFixed(1)).join(" / ")}，一个字符 ${charWidth.toFixed(1)}px）`);
    check(getComputedStyle(timeBox).fontVariantNumeric === "tabular-nums", `${label}：时间数字等宽`);
    check(rows[0].querySelector(".agent-session__elapsed")?.textContent?.startsWith("已运行"), `${label}：运行中的会话照常在状态里计时`);
    if (kind === "archivable") {
      const item = rows[1].closest("li")!;
      const more = item.querySelector<HTMLElement>(".agent-session__more button")!.getBoundingClientRect();
      const archive = item.querySelector<HTMLElement>(".agent-session__archive svg")!.getBoundingClientRect();
      const center = (box: DOMRect) => (box.left + box.right) / 2;
      check(Math.abs(center(more) - center(icons[1])) < 1 && Math.abs(archive.right - texts[0].right) < 1,
        `${label}：「⋯」正好盖在 Agent 图标上，归档图标和时间的右边缘对齐`);
    }
  }
  const before = document.querySelector(".agent-session__elapsed")?.textContent;
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1100)); });
  check(document.querySelector(".agent-session__elapsed")?.textContent !== before, "固定时间列后，运行中的计时仍每秒更新");
  context.fixture.style.height = "";
}
