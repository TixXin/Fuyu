import { act } from "react";
import { listenMessageSampleRequested } from "../../src/features/messages/api";
import type { SettingsCategory } from "../../src/windows/settings/categories";
import { mockBuiltinPlugins } from "./settingsMocks";

type Check = (condition: unknown, message: string) => void;
type OpenPage = (category: SettingsCategory) => Promise<void>;

const pause = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const group = (title: string) =>
  [...document.querySelectorAll<HTMLElement>(".editor-panel .settings-group")].find((found) => found.querySelector(".settings-group__title")?.textContent === title);
const names = (rows: HTMLElement[]) => rows.map((row) => row.querySelector(".settings-row__title")?.textContent?.trim() ?? "").join("|");
const sourceRow = (name: string) =>
  [...document.querySelectorAll<HTMLElement>(".editor-panel .source-row")].find((row) => row.querySelector(".settings-row__title")?.textContent?.trim() === name)!;
const toggleOf = (row: HTMLElement) => row.querySelector<HTMLInputElement>("input[role='switch']")!;
const messagesConfig = () => mockBuiltinPlugins().find((plugin) => plugin.id === "messages")?.config ?? {};
const button = (text: string) => [...document.querySelectorAll<HTMLButtonElement>(".editor-panel button")].find((found) => found.textContent?.trim() === text);
const until = async (ready: () => unknown) => {
  for (let tries = 0; tries < 80 && !ready(); tries += 1) await pause(50);
  return Boolean(ready());
};

export async function checkMessageSources(check: Check, openPage: OpenPage) {
  await openPage("messagesIm");
  await pause(40);

  const tabs = [...document.querySelectorAll(".settings-tabs__tab")].map((tab) => tab.textContent).join("|");
  check(tabs === "来源|提醒方式" && !document.querySelector(".editor-panel .feature-header"), "Messages has two tabs, sources first, and no header above them");
  check(names([...group("常用")!.querySelectorAll<HTMLElement>(".source-row")]) === "QQ|微信|邮箱", "QQ, WeChat and mail share one list");
  const others = () => group("更多聊天软件")!;
  const shown = () => [...others().querySelectorAll<HTMLElement>(":scope > .settings-group__card > .source-row")];
  const folded = () => [...others().querySelectorAll<HTMLElement>("details .source-row")];
  const fold = () => others().querySelector<HTMLDetailsElement>("details")!;
  check(names(shown()) === "Telegram|飞书" && names(folded()) === "Discord|WhatsApp|TIM|钉钉|企业微信" && !fold().open
    && fold().querySelector("summary")?.textContent === "还有 5 款没检测到安装",
    "Installed chat apps are listed; the ones not found on this computer are folded away");
  check(shown().every((row) => row.querySelector(".messages-settings__installed")?.textContent === "已安装" && !toggleOf(row).checked),
    "An installed app that is still off carries the Installed badge");
  const says = (name: string, text: string) => sourceRow(name).querySelector(".settings-row__description")?.textContent?.includes(text);
  check(says("QQ", "能看到发送人和内容") && says("微信", "只提示有新消息") && says("Telegram", "只提示有新消息") && says("Discord", "能看到发送人和内容"),
    "Each source says what it can read, before it is switched on too");
  const summary = () => document.querySelector(".source-summary__text strong")?.textContent;
  check(summary() === "已开 3 个来源" && document.querySelector(".source-summary__pill")?.textContent === "1 个要处理",
    "The summary counts the sources that are on and the mailbox that needs a new code");

  await act(async () => { toggleOf(sourceRow("Telegram")).click(); });
  await pause(40);
  check(messagesConfig().telegram === true && toggleOf(sourceRow("Telegram")).checked && summary() === "已开 4 个来源"
    && !sourceRow("Telegram").querySelector(".messages-settings__installed"),
    "Turning Telegram on saves messages.config.telegram and counts it");
  check(!document.querySelector(".editor-panel")!.textContent!.includes("看过后从岛上去掉"), "A source no longer has its own remove-once-seen switch");
  await act(async () => { sourceRow("Telegram").querySelector<HTMLButtonElement>(".source-row__more")!.click(); });
  check(sourceRow("Telegram").nextElementSibling?.classList.contains("settings-row--indent") && sourceRow("Telegram").nextElementSibling?.textContent?.includes("开启系统通知"),
    "How to see the content opens the note about the app's system notifications");
  await act(async () => { toggleOf(sourceRow("Telegram")).click(); });
  await pause(40);
  check(!toggleOf(sourceRow("Telegram")).checked && shown().length === 2 && summary() === "已开 3 个来源", "Turning Telegram back off closes its note");

  await act(async () => { fold().querySelector("summary")!.click(); });
  await pause(20);
  await act(async () => { toggleOf(sourceRow("Discord")).click(); });
  await pause(40);
  check(fold().open && fold().querySelector("summary")?.textContent === "收起没检测到的 5 款" && names(folded()).startsWith("Discord") && toggleOf(sourceRow("Discord")).checked,
    "An app switched on inside the fold stays where it was clicked");
  await act(async () => { toggleOf(sourceRow("Discord")).click(); });
  await pause(40);
  await act(async () => { fold().querySelector("summary")!.click(); });
  await pause(20);
}

export async function checkMessageNotice(check: Check, openPage: OpenPage) {
  await openPage("messages");
  await pause(40);
  const scene = () => document.querySelector<HTMLElement>(".notice-stage__scene")!;
  const card = (label: string) => [...document.querySelectorAll<HTMLButtonElement>(".settings-cards button")].find((found) => found.textContent?.includes(label))!;
  const saved = [...document.querySelectorAll<HTMLButtonElement>(".settings-cards button")].find((found) => found.getAttribute("aria-pressed") === "true" || found.classList.contains("settings-cards__card--active"))!;
  await act(async () => { card("一行预览").click(); });
  check(scene().dataset.notice === "line" && scene().querySelector(".notice-stage__line")?.textContent?.includes("奶茶到了"), "The demo shows the picked notice style with a sample message");
  await act(async () => { button("带验证码的邮件")!.click(); });
  await act(async () => { card("横幅").click(); });
  check(scene().dataset.notice === "banner" && scene().querySelector(".notice-stage__banner .notice-stage__copy")?.textContent === "复制 482913",
    "Picking the banner replays the demo as a banner, with the copy button for a code");
  const toggle = (title: string) => [...document.querySelectorAll<HTMLElement>(".editor-panel .settings-row")]
    .find((row) => row.querySelector(".settings-row__title")?.textContent === title)!.querySelector<HTMLInputElement>("input[role='switch']")!;
  await act(async () => { toggle("识别通知中的验证码").click(); });
  await pause(40);
  check(!scene().querySelector(".notice-stage__copy"), "Switching code detection off takes the copy button out of the demo");
  await act(async () => { toggle("识别通知中的验证码").click(); });
  await pause(40);

  check(toggle("看过后从岛上去掉").checked && messagesConfig().autoClear === undefined, "Remove once seen is one switch for every source and starts on");
  await act(async () => { toggle("看过后从岛上去掉").click(); });
  await pause(40);
  check(messagesConfig().autoClear === false && !toggle("看过后从岛上去掉").checked, "Switching it off saves messages.config.autoClear");
  await act(async () => { toggle("看过后从岛上去掉").click(); });
  await pause(40);

  let asked = 0;
  const stop = await listenMessageSampleRequested(() => { asked += 1; });
  await act(async () => { button("在真岛上试一下")!.click(); });
  check(await until(() => asked === 1 && button("已发到岛上")?.disabled), "Try it on the island asks the island for a sample message");
  check(await until(() => button("在真岛上试一下")), "The button comes back once the sample was sent");
  stop();
  await act(async () => { saved.click(); });
  await act(async () => { button("QQ 消息")!.click(); });
}
