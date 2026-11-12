import { act } from "react";
import { loadPinyin } from "../../src/features/clipboard/popupQuery";

type Check = (condition: unknown, label: string) => void;

export async function checkSecondRound(check: Check, calls: string[]) {
  const $ = <T extends HTMLElement = HTMLElement>(frame: string, selector: string) => document.querySelector<T>(`#frame-${frame} ${selector}`);
  const $$ = (frame: string, selector: string) => [...document.querySelectorAll<HTMLElement>(`#frame-${frame} ${selector}`)];
  const rows = (frame: string) => $$(frame, ".clipboard-popup__item");
  const keyOn = (target: Element | null, init: KeyboardEventInit) => act(async () => {
    target!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
  const key = (frame: string, init: KeyboardEventInit) => keyOn($(frame, ".clipboard-popup__search input"), init);
  const setValue = (target: HTMLInputElement | HTMLTextAreaElement | null, value: string) => act(async () => {
    const proto = target instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(target, value);
    target!.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const type = (frame: string, value: string) => setValue($<HTMLInputElement>(frame, ".clipboard-popup__search input"), value);
  const panelInput = (frame: string) => $<HTMLInputElement>(frame, ".clipboard-panel__head input");
  const pasted = (text: string) => calls.some((call) => call.startsWith("ipc:paste_clipboard_text:") && call.includes(JSON.stringify(text)));
  const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });

  await act(async () => { $$("dark", ".clipboard-popup__chip").find((chip) => chip.textContent === "全部")!.click(); });
  check(rows("dark")[6].querySelector(".clipboard-popup__swatch") && rows("dark")[6].querySelector(".clipboard-popup__badge")?.textContent === "颜色", "颜色：行首是色块，后面标「颜色」");
  check(rows("dark")[7].querySelector(".clipboard-popup__preview")?.textContent === "github.com › TixXin/fuyu › pull/26" && rows("dark")[7].querySelector(".clipboard-popup__badge")?.textContent === "链接", "链接：写成「域名 › 路径」，标「链接」");

  await act(async () => { await loadPinyin(); });
  await type("dark", "hy");
  check(rows("dark").some((row) => row.textContent?.includes("会议")), "拼音首字母 hy 搜到「会议」");
  await type("dark", "/app:微信");
  check(rows("dark").length === 2, "/app:微信 只看微信复制的");
  await type("dark", "");

  await key("dark", { key: "k", ctrlKey: true });
  check($("dark", ".clipboard-panel") && $$("dark", ".clipboard-panel__action").length > 8, "Ctrl+K 打开动作面板");
  await setValue(panelInput("dark"), "纯文本");
  await keyOn(panelInput("dark"), { key: "Enter" });
  check(calls.includes("paste:t1:plain") && !$("dark", ".clipboard-panel"), "面板里搜「纯文本」，Enter 执行并关上");

  await key("dark", { key: "End" });
  await key("dark", { key: "ArrowUp" });
  await key("dark", { key: "t", ctrlKey: true });
  await settle();
  check($("dark", ".clipboard-panel__result pre")?.textContent === "cargo test --quiet", "Ctrl+T 转换：多行命令合成一行，下面是粘贴结果");
  check($$("dark", ".clipboard-panel__action--off").some((row) => row.textContent?.includes("不是 JSON")), "用不上的转换灰掉并写原因");
  await keyOn(panelInput("dark"), { key: "Enter" });
  await settle();
  check(pasted("cargo test --quiet"), "Enter 粘贴转换后的文字");

  await key("dark", { key: "Enter", ctrlKey: true });
  check(calls.includes("paste:s9:enter"), "Ctrl+Enter 粘贴并回车");
  await key("dark", { key: " " });
  check($("dark", ".clipboard-look .clipboard-popup__pane-body")?.textContent?.includes("--quiet"), "空格：标准宽度也能看全文");
  await key("dark", { key: " " });
  check(!$("dark", ".clipboard-look"), "再按空格关上");

  await key("dark", { key: "e", ctrlKey: true });
  const editor = $<HTMLTextAreaElement>("dark", ".clipboard-editor textarea");
  await setValue(editor, "edited text");
  await keyOn(editor, { key: "s", ctrlKey: true });
  await settle();
  check(calls.some((call) => call.startsWith("ipc:add_clipboard_history_text:") && call.includes("edited text")) && !$("dark", ".clipboard-editor"), "Ctrl+E 编辑，Ctrl+S 另存为新记录");

  await key("dark", { key: "End" });
  await key("dark", { key: "Delete" });
  check(rows("dark").length === 9 && $("dark", ".clipboard-popup__hint--toast")?.textContent?.includes("已删除") && calls.some((call) => call.startsWith("ipc:delete_clipboard_history_item:")), "Del 删除：马上删掉（退出应用也算数），底栏能撤销");
  await key("dark", { key: "z", ctrlKey: true });
  check(rows("dark").length === 10 && calls.some((call) => call.startsWith("ipc:restore_clipboard_history_item:")), "Ctrl+Z 撤销：把这条放回去");

  await act(async () => { rows("dark")[0].querySelector<HTMLElement>(".clipboard-popup__row")!.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })); });
  await act(async () => { rows("dark")[6].querySelector<HTMLElement>(".clipboard-popup__row")!.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })); });
  check($("dark", ".clipboard-popup__separator")?.textContent?.includes("换行分隔"), "多选时底栏能合并粘贴，可换分隔");
  await key("dark", { key: "Enter", ctrlKey: true });
  await settle();
  check(pasted("主题从此不包含尺寸和显示内容，可以吗\n#E86A92"), "Ctrl+Enter 把挑的几条合成一段粘贴");
  await key("dark", { key: "Escape" });

  await key("dark", { key: "Home" });
  await key("dark", { key: "ArrowDown" });
  await key("dark", { key: "ArrowDown" });
  await key("dark", { key: "k", ctrlKey: true });
  await setValue(panelInput("dark"), "二维码");
  await keyOn(panelInput("dark"), { key: "Enter" });
  await settle();
  check(calls.some((call) => call.startsWith("ipc:read_clipboard_image_qr:")) && pasted("https://qr.example"), "图片：粘贴二维码内容");

  await key("dark", { key: "Home" });
  await key("dark", { key: "i", ctrlKey: true });
  check($("dark", ".clipboard-panel__result pre")?.textContent?.includes("快捷翻译") && !calls.some((call) => call.startsWith("ipc:rewrite_text")), "Ctrl+I：AI 改写，按 Enter 之前什么都不发");
  await keyOn(panelInput("dark"), { key: "Enter" });
  check($("dark", ".clipboard-panel__result pre")?.textContent === "AI:", "AI 的回答边生成边显示");
  await settle();
  check(calls.some((call) => call.startsWith("ipc:rewrite_text:") && call.includes('"task":"summarize"')) && $("dark", ".clipboard-panel__result pre")?.textContent === "AI:summarize", "Enter 用快捷翻译的服务总结，结果先显示");
  await keyOn(panelInput("dark"), { key: "Enter" });
  await settle();
  check(pasted("AI:summarize") && !$("dark", ".clipboard-panel"), "再按 Enter 粘贴 AI 的结果");

  await key("dark", { key: "i", ctrlKey: true });
  check($$("dark", ".clipboard-panel__group").some((group) => group.textContent === "自己的提示词") && $$("dark", ".clipboard-panel__action").some((row) => row.textContent?.includes("正式邮件")), "设置里写的提示词列在 AI 改写里");
  for (let step = 0; step < 4; step += 1) await keyOn(panelInput("dark"), { key: "ArrowDown" });
  await keyOn(panelInput("dark"), { key: "Enter" });
  await settle();
  check(calls.some((call) => call.startsWith("ipc:rewrite_text:") && call.includes('"task":"custom"') && call.includes("改成正式的邮件语气")), "选自己的提示词，按它改写");
  await keyOn(panelInput("dark"), { key: "Escape" });

  await key("dark", { key: "ArrowDown" });
  await key("dark", { key: "ArrowDown" });
  await key("dark", { key: "k", ctrlKey: true });
  await setValue(panelInput("dark"), "15");
  await keyOn(panelInput("dark"), { key: "Enter" });
  await settle();
  check(calls.some((call) => call.startsWith("ipc:pause_clipboard_capture:") && call.includes('"minutes":15')), "动作面板里暂停记录 15 分钟");

  await act(async () => { rows("dark")[0].querySelector<HTMLElement>(".clipboard-popup__row")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); });
  check($("dark", ".clipboard-panel"), "右键一行也打开动作面板");
  await keyOn(panelInput("dark"), { key: "Escape" });
  check(!$("dark", ".clipboard-panel"), "Esc 关上面板");

  check($("paused", ".clipboard-popup__pausebar")?.textContent?.includes("14 分钟后恢复") && $("paused", ".clipboard-popup__record")?.textContent === "已暂停", "暂停时列表上方写还剩多久，底栏写「已暂停」");
  await act(async () => { $("paused", ".clipboard-popup__pausebar button")!.click(); });
  await settle();
  check(calls.some((call) => call.startsWith("ipc:resume_clipboard_capture")), "点「现在恢复」");

  await key("wide", { key: "ArrowDown" });
  check($("wide", ".clipboard-kind__swatch")?.textContent === "#E86A92" && $$("wide", ".clipboard-kind__format").map((row) => row.textContent).join("|").includes("rgb(232, 106, 146)"), "宽版颜色：色块和 HEX / RGB / HSL");
  await act(async () => { $$("wide", ".clipboard-kind__format")[2].click(); });
  await settle();
  check(pasted("hsl(341, 73%, 66%)"), "点一种写法直接粘贴");
  await key("wide", { key: "ArrowDown" });
  const cleaned = $$("wide", ".clipboard-kind__format")[0]?.textContent ?? "";
  check($("wide", ".clipboard-kind__link b")?.textContent === "github.com › TixXin/fuyu › pull/26" && cleaned.includes("pull/26") && !cleaned.includes("utm_"), "宽版链接：标题（没联网时是域名和路径），去掉追踪参数的地址");
}
