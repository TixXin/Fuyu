import { act } from "react";
import { commands, islandNotch } from "./settingsMocks";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(ready: () => unknown, limit = 4000) {
  for (let spent = 0; !ready() && spent < limit; spent += 50) await act(async () => { await wait(50); });
  return Boolean(ready());
}

export async function checkAgentNoticeSettings(check: (condition: unknown, message: string) => void) {
  const stored = () => JSON.parse(localStorage.getItem("fuyu-settings") ?? "{}") as Record<string, unknown>;
  const click = (target: Element | null | undefined) => act(async () => { (target as HTMLElement | null | undefined)?.click(); });
  const combo = (label: string) => document.querySelector<HTMLButtonElement>(`.editor-panel button[role='combobox'][aria-label='${label}']`);
  const chip = (event: string) => document.querySelector<HTMLButtonElement>(`.agent-reminder-stage__chip[data-event='${event}']`);
  const shown = () => document.querySelector<HTMLElement>(".agent-reminder-stage__chip--active")?.dataset.event;
  const picture = (label: string) => document.querySelector<HTMLButtonElement>(`.agent-reminder-cards button[aria-label='${label}']`);
  const segment = (group: string, label: string) =>
    [...document.querySelectorAll<HTMLButtonElement>(`.settings-choice[aria-label='${group}'] .settings-choice__option`)].find((option) => option.textContent === label);
  const desk = () => document.querySelector<HTMLElement>(".agent-reminder-stage__desk");
  const deskButton = (label: string) => [...(desk()?.querySelectorAll("button") ?? [])].find((button) => button.textContent?.startsWith(label));
  const play = () => document.querySelector<HTMLButtonElement>(".agent-reminder-stage__play");
  const toggle = (key: string) => document.querySelector<HTMLInputElement>(`#agent-reminder-${key}`);
  const rowTitles = () => [...document.querySelectorAll(".agent-reminder .settings-row__title")].map((title) => title.textContent);
  const resetButton = () =>
    [...document.querySelectorAll<HTMLButtonElement>(".settings-group__header .settings-link-button")].find((button) => button.textContent === "恢复默认");
  const titles = [...document.querySelectorAll(".settings-group__title")].map((title) => title.textContent).join("|");
  const before = commands.length;

  check(titles.startsWith("什么时候提醒|通知的样子|通知的行为|审批按钮|"),
    "Agent > Alerts shows one table of events, then the notice look, behavior and approval groups");
  check(document.querySelectorAll(".agent-reminder-stage__chip").length === 7 && shown() === "approval" && deskButton("允许") && deskButton("拒绝"),
    "The preview on top offers seven kinds of notice and starts on the approval card, drawn with the real card");
  check(["没处理时再提醒", "等你回复的通知", "完成的通知停留", "出错的通知", "开始新一轮时"].every((label) => combo(label)),
    "Every stay time keeps its own drop-down in the event table");
  check(combo("开始新一轮时")?.textContent === "每一轮都弹出" && picture("状态优先")?.getAttribute("aria-pressed") === "true" && resetButton()?.disabled === false,
    "Saved settings from before keep popping up every turn, the style starts on status-first, and reset to default is available");
  check(!rowTitles().includes("Mac 刘海时"), "Without a notch the notch choice is not offered");

  await act(async () => { await wait(700); });
  check(!commands.slice(before).includes("set_agent_approval_hotkeys"), "The approval card in the preview does not take the global approval shortcuts");

  await click(picture("两翼 + 下拉"));
  check(stored().agentNoticeStyle === "wings" && picture("两翼 + 下拉")?.getAttribute("aria-pressed") === "true", "Picking another style card saves it");

  await click(segment("消息正文最多显示", "8 行"));
  check(stored().agentNoticeMessageLines === 8 && shown() === "done" && !deskButton("允许"),
    "Changing the message length saves it and moves the preview to a notice that has a message");

  await click(segment("按钮顺序", "允许 · 到终端 · 拒绝"));
  const order = [...(desk()?.querySelectorAll("button") ?? [])].map((button) => button.textContent ?? "").filter((label) => /^(允许|拒绝)/.test(label));
  check(stored().agentNoticeButtonOrder === "allowLeft" && shown() === "approval" && order[0]?.startsWith("允许"),
    "Changing the button order moves the preview back to the approval card, which shows the new order");

  await click(document.querySelector(".agent-reminder-row--failed .settings-row__title"));
  check(shown() === "failed" && toggle("agentAlertFailed")?.checked === true, "Clicking an event row shows that notice without flipping its switch");

  await click(toggle("agentAlertCompleted"));
  check(stored().agentAlertCompleted === false && shown() === "done" && desk()?.querySelector(".agent-reminder-pill") && !desk()?.querySelector(".agent-reminder-frame"),
    "Turning off the pop-up for finished sessions saves it, and the preview shows the collapsed island instead of a card");
  await click(toggle("agentAlertCompleted"));
  check(stored().agentAlertCompleted === true && desk()?.querySelector(".agent-reminder-frame"), "Turning it back on brings the card back");

  await click(chip("approval"));
  await click(play());
  check(play()?.textContent === "停止" && desk()?.querySelector(".agent-reminder-pill"), "Play starts from the collapsed island");
  check(await until(() => desk()?.querySelector(".agent-reminder-stage__drop--in") && deskButton("允许")?.disabled === false), "…then the approval card drops in and waits");
  await click(deskButton("允许"));
  check(await until(() => play()?.textContent === "播放") && deskButton("允许"), "Answering it ends the playback and the preview is back");

  await click(resetButton());
  check(stored().agentNoticeStyle === "status" && stored().agentAlertStarted === "off" && stored().agentNoticeButtonOrder === "allowRight"
    && combo("开始新一轮时")?.textContent === "只在收起条显示标题" && resetButton()?.disabled === true,
    "Reset to default puts the notice items back to the recommended set");

  islandNotch.value = { width: 200, height: 32 };
  await click(document.querySelector(".settings-tabs__tab[data-tab='sounds']"));
  await click(document.querySelector(".settings-tabs__tab[data-tab='agentAlerts']"));
  const notched = await until(() => rowTitles().includes("Mac 刘海时"));
  islandNotch.value = null;
  check(notched && document.querySelector(".agent-reminder-stage [data-notice-notch='on'] .agent-notice-stack__notch"),
    "On a Mac with a notch the notch choice appears and the preview draws the band beside the notch");
}
