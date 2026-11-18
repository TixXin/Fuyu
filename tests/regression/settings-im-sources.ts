import { act } from "react";
import type { SettingsCategory } from "../../src/windows/settings/categories";
import { mockBuiltinPlugins } from "./settingsMocks";

export async function checkImMessageSources(
  check: (condition: unknown, message: string) => void,
  openPage: (category: SettingsCategory) => Promise<void>,
) {
  await openPage("messagesIm");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });

  const othersGroup = () =>
    [...document.querySelectorAll<HTMLElement>(".editor-panel .settings-group")].find((group) =>
      group.querySelector(".settings-group__title")?.textContent === "更多聊天软件",
    );
  const rows = () => [...(othersGroup()?.querySelectorAll<HTMLElement>(":scope > .settings-group__card > .settings-row") ?? [])];
  const titles = () => rows().map((row) => row.querySelector(".settings-row__title")?.textContent?.trim() ?? "");

  check(
    titles().join("|") === "接收 Telegram 消息|接收飞书消息|接收 Discord 消息|接收 WhatsApp 消息|接收 TIM 消息|接收钉钉消息|接收企业微信消息",
    "Installed IM apps appear first in Settings > Messages > IM, followed by uninstalled ones",
  );
  const badges = rows().filter((row) => row.querySelector(".messages-settings__installed")?.textContent === "已安装");
  check(badges.length === 2 && badges[0] === rows()[0] && badges[1] === rows()[1], "Installed IM apps carry the Installed badge");
  check(
    rows().every((row) => row.querySelector<HTMLInputElement>("input[role='switch']")?.checked === false && !row.querySelector(".settings-row__description")),
    "All 7 new IM sources start off as compact single-line rows",
  );

  const telegramSwitch = () => rows()[0].querySelector<HTMLInputElement>("input[role='switch']")!;
  await act(async () => { telegramSwitch().click(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });

  check(
    mockBuiltinPlugins().find((plugin) => plugin.id === "messages")?.config.telegram === true
      && telegramSwitch().checked === true,
    "Turning Telegram on saves messages.config.telegram = true",
  );
  check(
    Boolean(rows()[0].querySelector(".settings-row__description")?.textContent?.includes("开启系统通知"))
      && rows()[1]?.classList.contains("settings-row--indent")
      && rows()[1]?.querySelector(".settings-row__title")?.textContent === "看过后从岛上去掉"
      && rows()[1]?.querySelector<HTMLInputElement>("input[role='switch']")?.checked === true,
    "Turning Telegram on expands its Windows system-notification hint and default-on auto-clear switch",
  );
  check(
    document.querySelector(".feature-header__aside")?.textContent === "已开 4 个来源",
    "Header active source count includes enabled IM sources",
  );

  await act(async () => { telegramSwitch().click(); });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 40)); });
  check(
    telegramSwitch().checked === false && rows().length === 7,
    "Turning Telegram back off collapses its sub-row",
  );
}
