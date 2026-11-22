import { act } from "react";
import { emit } from "@tauri-apps/api/event";
import { commands, emittedTo, islandNotch } from "./settingsMocks";

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
  const tryOnIsland = () => document.querySelector<HTMLButtonElement>(".agent-reminder-stage__try");
  const stageNote = () => document.querySelector(".agent-reminder-stage__note")?.textContent ?? "";
  const tests = () => emittedTo.filter((sent) => sent.event === "agent-test-notice").map((sent) => ({ label: sent.label, ...(sent.payload as { id: number; event: string; sessions: unknown[]; request: unknown }) }));
  const toggle = (key: string) => document.querySelector<HTMLInputElement>(`#agent-reminder-${key}`);
  const soundSwitch = (name: string) => document.querySelector<HTMLInputElement>(`#agent-sound-${name}`);
  const pushSwitch = (name: string) => document.querySelector<HTMLInputElement>(`#agent-push-${name}`);
  const storedSounds = () => JSON.parse(localStorage.getItem("fuyu-agent-sounds") ?? "{}") as { events?: Record<string, boolean> };
  const tableRows = () => [...document.querySelectorAll(".agent-event-table tbody .agent-event-table__title")].map((title) => title.textContent);
  const head = (index: number) => document.querySelectorAll<HTMLElement>(".agent-event-table thead th")[index];
  const tab = (name: string) => click(document.querySelector(`.settings-tabs__tab[data-tab='${name}']`));
  const activeTab = () => document.querySelector<HTMLElement>(".settings-tabs__tab--active")?.dataset.tab;
  const rowTitles = () => [...document.querySelectorAll(".agent-reminder .settings-row__title")].map((title) => title.textContent);
  const resetButton = () =>
    [...document.querySelectorAll<HTMLButtonElement>(".settings-group__header .settings-link-button")].find((button) => button.textContent === "恢复默认");
  const groupTitles = () => [...document.querySelectorAll(".settings-group__title")].map((title) => title.textContent).join("|");
  const before = commands.length;

  check(groupTitles() === "每件事从哪儿提醒你" && document.querySelectorAll(".agent-event-table").length === 1,
    "Agent > Alerts opens on one table of events under the preview");
  check(tableRows().join("|") === "等你确认或回答|完成|出错|开始新一轮|发出消息|上下文快满|闲置等你|额度快用完|额度已刷新",
    "The table has one row per event, named the same way for the island, sound and phone");
  check(document.querySelectorAll(".agent-event-table [id^='agent-sound-']").length === 10 && document.querySelectorAll(".agent-event-table [id^='agent-push-']").length === 3
    && ["agentAlertWaiting", "agentAlertCompleted", "agentAlertFailed"].every((key) => toggle(key)),
    "Every sound and push switch and every island switch shows up in the table exactly once");
  check(document.querySelectorAll(".agent-event-table__row--active").length === 1 && document.querySelector(".agent-event-table__row--active.agent-reminder-row--waiting"),
    "The row of the notice the preview shows is marked");
  check(document.querySelectorAll(".agent-reminder-stage__chip").length === 7 && shown() === "approval" && deskButton("允许") && deskButton("拒绝"),
    "The preview on top offers seven kinds of notice and starts on the approval card, drawn with the real card");
  check(combo("开始新一轮时")?.textContent === "每一轮都弹出" && combo("额度提醒")?.textContent === "用到 80%",
    "Saved settings from before keep popping up every turn, and the quota line moved into the table");
  const pushOn = (JSON.parse(localStorage.getItem("fuyu-agent-push") ?? "{}") as { enabled?: boolean }).enabled === true;
  check(pushSwitch("completed")?.disabled === !pushOn && head(3)?.textContent?.includes(pushOn ? "设置 ›" : "没开") && soundSwitch("complete")?.disabled === false && head(2)?.textContent?.includes("音量"),
    `The phone column follows phone push (${pushOn ? "on: shows the channel" : "off: greyed out and says so"}); sound is on and shows its volume`);

  await click(soundSwitch("complete"));
  check(storedSounds().events?.complete === false, "A sound switch in the table saves to the sound settings");
  await click(soundSwitch("complete"));
  check(storedSounds().events?.complete === true, "…and turns back on");

  await click(document.querySelector(".agent-reminder-row--failed .agent-event-table__title"));
  check(shown() === "failed" && toggle("agentAlertFailed")?.checked === true && document.querySelector(".agent-event-table__row--active.agent-reminder-row--failed"),
    "Clicking an event row shows that notice without flipping its switch");

  await click(toggle("agentAlertCompleted"));
  check(stored().agentAlertCompleted === false && shown() === "done" && desk()?.querySelector(".agent-reminder-pill") && !desk()?.querySelector(".agent-reminder-frame"),
    "Turning off the pop-up for finished sessions saves it, and the preview shows the collapsed island instead of a card");
  check(tryOnIsland()?.disabled === true, "A kind of notice that is turned off cannot be tried on the island");
  await click(toggle("agentAlertCompleted"));
  check(stored().agentAlertCompleted === true && desk()?.querySelector(".agent-reminder-frame") && tryOnIsland()?.disabled === false, "Turning it back on brings the card back");

  await act(async () => { await wait(700); });
  check(!commands.slice(before).includes("set_agent_approval_hotkeys"), "The approval card in the preview does not take the global approval shortcuts");

  await click(chip("approval"));
  await click(play());
  check(play()?.textContent === "停止" && desk()?.querySelector(".agent-reminder-pill"), "Play starts from the collapsed island");
  check(await until(() => desk()?.querySelector(".agent-reminder-stage__drop--in") && deskButton("允许")?.disabled === false), "…then the approval card drops in and waits");
  await click(deskButton("允许"));
  check(await until(() => play()?.textContent === "播放") && deskButton("允许"), "Answering it ends the playback and the preview is back");

  const idle = stageNote();
  await click(tryOnIsland());
  const asked = tests()[0];
  check(tests().length === 1 && asked.label === "main" && asked.event === "approval" && asked.sessions.length === 1 && asked.request,
    "「在岛上试一下」 asks the island window for a test of the notice the preview shows, with its sample session and request");
  await act(async () => { await emit("agent-test-notice-result", { id: asked.id, outcome: "busy" }); });
  check(await until(() => stageNote() === "岛上正有真的提醒，等它收起后再试") && tryOnIsland()?.disabled === false, "When the island answers that a real notice is up, the stage says so");
  await click(chip("stack"));
  check(stageNote() !== "岛上正有真的提醒，等它收起后再试", "Choosing another kind of notice clears that answer");
  await click(tryOnIsland());
  check(tests().length === 2 && tests()[1].event === "stack" && tests()[1].sessions.length === 3 && tests()[1].request === null, "Trying several sessions sends all three");
  check(await until(() => stageNote() === "岛没有回应，确认岛在运行后再试"), "When the island does not answer, the stage says so instead of waiting forever");
  await click(chip("approval"));
  check(stageNote() === idle, "…and the usual note about this notice is back");

  await click(head(3)?.querySelector(".agent-event-table__go"));
  check(activeTab() === "agentPush", "The link in the phone column header goes to the push tab");

  await tab("agentNoticeLook");
  check(groupTitles().startsWith("停留多久|通知的样子|通知的行为|审批按钮"),
    "Notice look has the stay times first, then the look, behavior and approval groups, with the same preview on top");
  check(document.querySelectorAll(".agent-reminder-stage").length === 1 && !document.querySelector(".agent-event-table"), "…and no event table");
  check(["没处理时再提醒", "等你回复的通知", "完成的通知停留", "出错的通知"].every((label) => combo(label)) && !combo("开始新一轮时"),
    "The stay times moved off the event rows into their own group");
  check(picture("状态优先")?.getAttribute("aria-pressed") === "true" && resetButton()?.disabled === false, "The style starts on status-first, and reset to default is available");
  check(!rowTitles().includes("Mac 刘海时"), "Without a notch the notch choice is not offered");

  await click(picture("两翼 + 下拉"));
  check(stored().agentNoticeStyle === "wings" && picture("两翼 + 下拉")?.getAttribute("aria-pressed") === "true", "Picking another style card saves it");

  await click(segment("消息正文最多显示", "8 行"));
  check(stored().agentNoticeMessageLines === 8 && shown() === "done" && !deskButton("允许"),
    "Changing the message length saves it and moves the preview to a notice that has a message");

  await click(segment("按钮顺序", "允许 · 到终端 · 拒绝"));
  const order = [...(desk()?.querySelectorAll("button") ?? [])].map((button) => button.textContent ?? "").filter((label) => /^(允许|拒绝)/.test(label));
  check(stored().agentNoticeButtonOrder === "allowLeft" && shown() === "approval" && order[0]?.startsWith("允许"),
    "Changing the button order moves the preview back to the approval card, which shows the new order");

  await click(resetButton());
  check(stored().agentNoticeStyle === "status" && stored().agentAlertStarted === "off" && stored().agentNoticeButtonOrder === "allowRight" && resetButton()?.disabled === true,
    "Reset to default puts the notice items back to the recommended set");

  islandNotch.value = { width: 200, height: 32 };
  await tab("sounds");
  check(!document.querySelector("[id^='agent-sound-']") && [...document.querySelectorAll(".settings-link-button")].some((button) => button.textContent === "在事件总表里改 ›"),
    "The sound tab no longer lists the events and links to the event table instead");
  await tab("agentNoticeLook");
  const notched = await until(() => rowTitles().includes("Mac 刘海时"));
  islandNotch.value = null;
  check(notched && document.querySelector(".agent-reminder-stage [data-notice-notch='on'] .agent-notice-stack__notch"),
    "On a Mac with a notch the notch choice appears and the preview draws the band beside the notch");
}
