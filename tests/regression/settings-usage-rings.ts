import { act } from "react";
import { setBuiltinConfig } from "../../src/features/plugin-kernel/builtinSwitches";
import { HOVER_USAGE_PROVIDERS, USAGE_PROVIDERS } from "../../src/features/claude-usage/usageRing";
import { mockBuiltinPlugins } from "./settingsMocks";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(ready: () => unknown, limit = 2000) {
  for (let spent = 0; !ready() && spent < limit; spent += 50) await act(async () => { await wait(50); });
  return Boolean(ready());
}

export async function checkUsageRingsRecovery(check: (condition: unknown, message: string) => void) {
  const ids = [...USAGE_PROVIDERS, ...HOVER_USAGE_PROVIDERS].map((provider) => provider.id);
  const group = () => [...document.querySelectorAll<HTMLElement>(".settings-group")].find((found) => found.querySelector(".settings-group__title")?.textContent === "用量环");
  const allOffRow = () => [...(group()?.querySelectorAll(".settings-row__title") ?? [])].some((title) => title.textContent === "每一家都关掉了");
  const providerSwitch = (id: string) => group()?.querySelector<HTMLInputElement>(`[data-usage-provider='${id}'] input[type='checkbox']`);
  const config = () => mockBuiltinPlugins().find((plugin) => plugin.id === "claude-usage")?.config ?? {};

  check(group() && !allOffRow() && !providerSwitch("claudeCode"), "用量环分组平时只放「在岛布局里调整」，各家开关在岛布局的样式面板里");
  await act(async () => {
    for (const id of ids) await setBuiltinConfig("claude-usage", id, false);
  });
  check(await until(allOffRow), "每一家都关掉后，用量环分组写明全关了");
  const rows = ids.filter((id) => providerSwitch(id));
  check(rows.length === ids.length && rows.every((id) => providerSwitch(id)?.checked === false), `全关后各家的开关直接放在 Agent 页的用量环分组里：${rows.join()}`);
  const hint = group()?.querySelector<HTMLElement>(".settings-row__description");
  check(hint && hint.scrollWidth <= hint.clientWidth + 1, "全关提示在设置窗口里不溢出");
  await act(async () => { providerSwitch("claudeCode")?.click(); });
  check(await until(() => config().claudeCode !== false && !allOffRow()), "在这里打开 Claude Code 后存进配置，用量环回到收起条，分组恢复平时的样子");
  await act(async () => {
    for (const id of ids) await setBuiltinConfig("claude-usage", id, null);
  });
}
