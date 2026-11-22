import { act } from "react";
import { DEFAULT_NOTCH_TEXT, saveNotchText, type NotchTextMode } from "../../src/lib/settings/collapsedText";
import type { MessagePreview } from "../../src/features/messages/messagePreview";

type Helpers = {
  check: (condition: unknown, label: string) => void;
  set: (next: { text?: boolean; todo?: string; preview?: MessagePreview | null }) => Promise<void>;
  settle: () => Promise<void>;
  island: () => HTMLElement;
  bar: () => HTMLElement;
  chip: () => HTMLButtonElement | null;
  panel: () => HTMLElement | null;
  opened: () => string | undefined;
  notchHeight: number;
};

const TODO = "写周报和整理会议记录";

export async function checkNotchText({ check, set, settle, island, bar, chip, panel, opened, notchHeight }: Helpers) {
  const mode = (todos: NotchTextMode) => act(async () => { saveNotchText({ ...DEFAULT_NOTCH_TEXT, todos }); });
  const row = () => bar().querySelector<HTMLElement>(".island__notch-drop");
  const tall = () => Math.abs(island().getBoundingClientRect().height - (notchHeight + 38)) < 1;
  const flat = () => Math.abs(island().getBoundingClientRect().height - notchHeight) < 1;

  check(!chip() && !row() && flat(), "刘海屏的文字没打开时照旧：待办不上岛、没有「+N」");
  await set({ text: true });
  await settle();
  check(chip()?.textContent === "+1" && !row() && flat(), "默认收进「+N」：只有待办时「+N」也出现，数字把文字算进去，刘海下面不长一行");
  await act(async () => { chip()!.click(); });
  const line = panel()?.querySelector<HTMLElement>(".island-more-panel__text[data-item='todos.title']");
  check(line?.textContent?.includes(TODO) && line.getAttribute("role") === "menuitem", "点开小面板，上面是待办的文字");
  await act(async () => { line!.click(); });
  check(!panel() && opened() === "todo", "点小面板里的文字打开它那一页");

  await mode("row");
  await settle();
  check(row()?.textContent?.includes(TODO) && !chip() && tall(), "选「刘海下常驻一行」：待办放在刘海下面那一行，岛加高一行，「+N」不再为它出现");
  await set({ preview: { source: "wechat", title: "李四", body: "新版设计稿放在共享盘了", chat: "产品群", receivedAt: Date.now() } });
  await settle();
  check(row()?.textContent?.includes("新版设计稿") && !row()?.textContent?.includes(TODO), "来了消息时那一行先让给消息");
  await set({ preview: null });
  await settle();
  check(row()?.textContent?.includes(TODO), "消息走了，待办回到那一行");

  await mode("flash");
  await settle();
  check(!row() && !chip() && flat(), "选「有变化时出现 4 秒」：没变化时不占那一行");
  await set({ todo: "回复客户邮件" });
  await settle();
  check(row()?.textContent?.includes("回复客户邮件") && tall(), "待办换了，出现在刘海下面");
  let left = false;
  for (let waited = 0; waited < 6000 && !left; waited += 100) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
    left = row() === null;
  }
  await settle();
  check(left && flat(), "4 秒后收回去，岛缩回刘海高");

  await mode("off");
  await settle();
  check(!row() && !chip(), "选「不显示」：哪里都不出现");
  await act(async () => { saveNotchText(DEFAULT_NOTCH_TEXT); });
  await set({ text: false, todo: TODO });
  await settle();
}
