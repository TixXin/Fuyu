import { act } from "react";

const SENDERS_KEY = "fuyu-plugin-notice-senders";
const MUTES_KEY = "fuyu-plugin-notice-mutes";

export async function checkLocalApiNotify(check: (condition: unknown, message: string) => void) {
  const row = (title: string) =>
    [...document.querySelectorAll<HTMLElement>(".editor-panel .settings-row")].find(
      (item) => item.querySelector(".settings-row__title")?.textContent === title,
    );
  const toggle = (title: string) => row(title)?.querySelector<HTMLInputElement>("input[role='switch']");
  const groups = () => [...document.querySelectorAll(".editor-panel .settings-group__title")].map((title) => title.textContent).join("|");
  const example = () => document.querySelector(".local-api-example__code")?.textContent ?? "";
  const stored = (key: string) => JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
  const announce = async (key: string) => {
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key }));
    });
  };

  check(
    toggle("允许弹消息")?.checked === false && (row("弹消息")?.textContent ?? "").includes("/v1/notify") && (row("弹消息")?.textContent ?? "").includes("要先打开「允许弹消息」"),
    "Messages are off by default: its own switch next to Allow changes, and the row for /v1/notify says to turn it on",
  );
  await act(async () => {
    toggle("允许弹消息")?.click();
  });
  check(
    toggle("允许弹消息")?.checked === true && toggle("允许修改待办、笔记和 Agent 状态")?.checked === false && (row("弹消息")?.textContent ?? "").includes("可以弹消息"),
    "Turning messages on does not turn changes on, and the row says messages can be sent",
  );
  check(
    example().includes("http://127.0.0.1:39271/v1/notify") && example().includes('"source":"demo"') && example().includes("local-api.json"),
    "With messages allowed the example sends one instead of calling the health route",
  );

  check(groups() === "本机接口|权限|试一下", "No source list until something has sent a message");
  localStorage.setItem(SENDERS_KEY, JSON.stringify(["dev.example.todo-sync", "local-api/ci", "local-api/backup"]));
  await announce(SENDERS_KEY);
  const sources = () => [...document.querySelectorAll<HTMLElement>(".editor-panel .settings-group")]
    .find((group) => group.querySelector(".settings-group__title")?.textContent === "消息来源");
  const sourceTitles = () => [...(sources()?.querySelectorAll(".settings-row__title") ?? [])].map((title) => title.textContent).join("|");
  check(
    groups() === "本机接口|权限|消息来源|试一下" && sourceTitles() === "backup|ci",
    "Sources that sent a message through the local API are listed by name, without the plugins that sent notices",
  );
  await act(async () => {
    toggle("ci")?.click();
  });
  check(
    stored(MUTES_KEY).join() === "local-api/ci" && toggle("ci")?.checked === false && toggle("backup")?.checked === true && (row("ci")?.textContent ?? "").includes("已静音"),
    "Switching one source off mutes only that source, under its local-api/ id",
  );
  await act(async () => {
    toggle("ci")?.click();
  });
  check(stored(MUTES_KEY).length === 0 && toggle("ci")?.checked === true, "Switching it back on removes the mute");

  localStorage.removeItem(SENDERS_KEY);
  localStorage.removeItem(MUTES_KEY);
  await announce(SENDERS_KEY);
  await act(async () => {
    toggle("允许弹消息")?.click();
  });
  check(toggle("允许弹消息")?.checked === false && example().includes("/v1/health") && groups() === "本机接口|权限|试一下", "Turning messages off again brings the health example back");
}
