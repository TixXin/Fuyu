import { act } from "react";

export async function checkAgentNoticeSettings(check: (condition: unknown, message: string) => void) {
  const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;
  const combo = (label: string) => document.querySelector<HTMLButtonElement>(`.editor-panel button[role='combobox'][aria-label='${label}']`);
  const resetButton = () =>
    [...document.querySelectorAll<HTMLButtonElement>(".settings-group__header .settings-link-button")].find((button) => button.textContent === "恢复默认");
  const titles = [...document.querySelectorAll(".settings-group__title")].map((title) => title.textContent).join("|");

  check(titles.startsWith("弹出提醒|通知的样子|通知的行为|审批按钮|"),
    "Agent > Alerts shows the pop-up switches, then the notice look, behavior and approval groups");
  const items = ["通知样式", "Mac 刘海时", "消息正文最多显示", "运行中的命令最多显示", "模型、用时、「你：」", "滚动条", "开始新一轮时", "等你回复的通知", "出错的通知", "完成的通知停留", "点通知", "多个会话同时来", "按钮顺序"];
  check(items.every((label) => combo(label)), "Every notice choice has its own drop-down");
  check(combo("通知样式")?.textContent === "状态优先（默认）" && combo("开始新一轮时")?.textContent === "每一轮都弹出" && resetButton()?.disabled === false,
    "Saved settings from before keep popping up every turn, the style starts on status-first, and reset to default is available");

  await act(async () => { combo("通知样式")!.click(); });
  const wings = [...document.querySelectorAll<HTMLElement>("[role='option']")].find((option) => option.textContent === "两翼 + 下拉");
  await act(async () => { wings?.click(); });
  check(stored().agentNoticeStyle === "wings" && combo("通知样式")?.textContent === "两翼 + 下拉", "Picking another style saves it");

  await act(async () => { resetButton()!.click(); });
  check(stored().agentNoticeStyle === "status" && stored().agentAlertStarted === "off" && combo("开始新一轮时")?.textContent === "只在收起条显示标题（默认）" && resetButton()?.disabled === true,
    "Reset to default puts the notice items back to the recommended set");
}
