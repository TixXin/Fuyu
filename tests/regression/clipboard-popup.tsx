import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockConvertFileSrc, mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { ClipboardPopup } from "../../src/features/clipboard/ClipboardPopup";
import type { ClipboardHistoryItem, ClipboardSnippet } from "../../src/features/clipboard/api";
import { checkSecondRound } from "./clipboard-popup-actions";

const automated = new URLSearchParams(location.search).has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
const calls: string[] = [];
mockIPC((command, args) => {
  calls.push(`ipc:${command}:${JSON.stringify(args ?? {})}`);
  if (command === "read_clipboard_image_qr") return "https://qr.example";
  if (command === "rewrite_text") {
    const { task, onChunk } = args as { task: string; onChunk: { id: number } };
    const internals = (window as unknown as { __TAURI_INTERNALS__: { runCallback: (id: number, data: unknown) => void } }).__TAURI_INTERNALS__;
    internals.runCallback(onChunk.id, { index: 0, message: "AI:" });
    return new Promise((resolve) => setTimeout(() => {
      internals.runCallback(onChunk.id, { index: 1, message: task });
      resolve(`AI:${task}`);
    }, 20));
  }
  return null;
});

mockConvertFileSrc("windows");
const peeks: string[] = [];

const now = Date.now();
const minute = 60_000;
const thumb = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%232a3350'/%3E%3C/svg%3E";
const base = { hash: "", createdAt: now, favorite: false } as const;
const ITEMS: ClipboardHistoryItem[] = [
  { ...base, id: "t1", kind: "text", copiedAt: now - 20_000, preview: "主题从此不包含尺寸和显示内容，可以吗", text: "主题从此不包含尺寸和显示内容，可以吗", source: { path: "C:\\code.exe", name: "VS Code" } },
  { ...base, id: "t2", kind: "text", copiedAt: now - 2 * minute, preview: "pnpm test:regression clipboard && git status --short", favorite: true, source: { path: "C:\\wt.exe", name: "终端" } },
  { ...base, id: "i1", kind: "image", copiedAt: now - 5 * minute, preview: "770 x 148 image", ocrText: "已不在", image: { width: 770, height: 148, byteSize: 43_000, originalPath: "", thumbnailPath: "", thumbnailDataUrl: thumb }, source: { path: "C:\\weixin.exe", name: "微信" } },
  { ...base, id: "t3", kind: "text", copiedAt: now - 12 * minute, preview: "题市场放在「扩展」组和插件市场挨着，还是放在「基础」组紧跟「主题」？", tags: ["设置"], source: { path: "C:\\msedge.exe", name: "Edge" } },
  { ...base, id: "t4", kind: "text", copiedAt: now - 20 * minute, preview: "ghp_8f3a••••••••••••••••", masked: true, text: "ghp_8f3aSECRETSECRETSECRET" },
  { ...base, id: "f1", kind: "files", copiedAt: now - 70 * minute, preview: "release-notes-0.3.5.md", files: ["C:\\a\\release-notes-0.3.5.md", "C:\\a\\b.md", "C:\\a\\c.md"], source: { path: "C:\\explorer.exe", name: "资源管理器" } },
  { ...base, id: "c1", kind: "text", copiedAt: now - 80 * minute, preview: "#E86A92", text: "#E86A92", source: { path: "C:\\figma.exe", name: "Figma" } },
  { ...base, id: "l1", kind: "text", copiedAt: now - 90 * minute, preview: "https://github.com/TixXin/fuyu/pull/26?utm_source=chat", text: "https://github.com/TixXin/fuyu/pull/26?utm_source=chat" },
  { ...base, id: "s9", kind: "text", copiedAt: now - 100 * minute, preview: "cargo test \\ --quiet", text: "cargo test \\\n  --quiet", source: { path: "C:\\wt.exe", name: "终端" } },
  { ...base, id: "m1", kind: "text", copiedAt: now - 110 * minute, preview: "下午三点的会议改到四点", text: "下午三点的会议改到四点", source: { path: "C:\\weixin.exe", name: "微信" } },
];
const SNIPPETS: ClipboardSnippet[] = [{ id: "s1", title: "日报模板", text: "{date} {weekday}\n今天完成：" }, { id: "s2", title: "邮箱签名", text: "tixxin · Fuyu" }];

const FRAMES = [
  { id: "dark", caption: "标准宽度", wide: false, light: false },
  { id: "light", caption: "浅色", wide: false, light: true },
  { id: "wide", caption: "宽版", wide: true, light: false },
  { id: "paused", caption: "暂停记录", wide: false, light: false },
];
const host = document.getElementById("frames")!;
for (const frame of FRAMES) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<p class="caption">${frame.caption}</p>`;
  const box = document.createElement("div");
  box.className = `frame frame--${frame.wide ? "wide" : "standard"}${frame.light ? " island-light" : ""}`;
  box.id = `frame-${frame.id}`;
  wrap.append(box);
  host.append(wrap);
  const root = createRoot(box);
  const render = () => root.render(
    <StrictMode><I18nProvider>
      <ClipboardPopup
        items={ITEMS}
        snippets={SNIPPETS}
        openCount={0}
        wide={frame.wide}
        ownsWindow={frame.id === "light"}
        aiPrompts={[{ id: "p1", title: "正式邮件", prompt: "改成正式的邮件语气" }]}
        capture={frame.id === "paused" ? { paused: true, pausedUntil: now + 14 * minute, ignoreNext: false } : undefined}
        onPaste={(id, plain, options) => calls.push(`paste:${id}${plain ? ":plain" : ""}${options?.enter ? ":enter" : ""}${options?.copyAs ? `:${options.copyAs}` : ""}`)}
        onPasteSnippet={(id) => calls.push(`snippet:${id}`)}
        onPasteSequence={(ids) => calls.push(`sequence:${ids.join()}`)}
        onClose={() => calls.push("close")}
        onToggleFavorite={(id) => calls.push(`star:${id}`)}
        onPeek={frame.id === "paused" ? (peek) => peeks.push(peek ? `${peek.item.id}${peek.holding ? ":hold" : ""}${peek.prefetch.length ? `:${peek.prefetch.join("+")}` : ""}` : "close") : undefined}
      />
    </I18nProvider></StrictMode>,
  );
  if (automated) await act(async () => render());
  else render();
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const $ = <T extends HTMLElement = HTMLElement>(frame: string, selector: string) => document.querySelector<T>(`#frame-${frame} ${selector}`);
const $$ = (frame: string, selector: string) => [...document.querySelectorAll<HTMLElement>(`#frame-${frame} ${selector}`)];
const key = (frame: string, init: KeyboardEventInit) => act(async () => {
  $(frame, "input")!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
});
const type = (frame: string, value: string) => act(async () => {
  const input = $<HTMLInputElement>(frame, "input")!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const rows = (frame: string) => $$(frame, ".clipboard-popup__item");
const chips = (frame: string) => $$(frame, ".clipboard-popup__chip").map((chip) => chip.textContent).join("|");
const selectedChip = (frame: string) => $(frame, '.clipboard-popup__chip[aria-selected="true"]')?.textContent;
const ctrlClick = (frame: string, index: number) => act(async () => {
  rows(frame)[index].querySelector<HTMLElement>(".clipboard-popup__row")!.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
});

async function runChecks() {
  try {
    check(chips("dark") === "全部|收藏|图片|文件|网址|颜色|常用语|#设置", "筛选胶囊：全部、收藏、图片、文件、网址、颜色、常用语，再加常用标签");
    check(rows("dark").length === ITEMS.length && rows("dark")[0].classList.contains("clipboard-popup__item--selected"), "每条一行，打开时第 1 条选中");
    check($("dark", ".clipboard-popup__item--selected .clipboard-popup__enter")?.textContent === "粘贴", "选中的那行写着「↵ 粘贴」");
    check(rows("dark")[0].querySelector(".clipboard-popup__note")?.textContent?.startsWith("VS Code") && !rows("dark")[0].querySelector(".clipboard-popup__time") && rows("dark")[1].querySelector(".clipboard-popup__time")?.textContent === "2 分钟前", "第二行写来源程序，时间放在右边；选中的行右边换成「↵ 粘贴」");
    check(rows("dark")[2].querySelector(".clipboard-popup__preview")?.textContent === "图片 770×148" && rows("dark")[2].querySelector("img"), "图片写成「图片 宽×高」，行首是缩略图");
    check(rows("dark")[3].querySelector(".clipboard-popup__tag")?.textContent === "#设置", "标签在第二行开头");
    check(rows("dark")[1].querySelector(".clipboard-popup__star--on"), "收藏过的行尾有星");

    await key("dark", { key: "Tab" });
    check(selectedChip("dark") === "收藏" && rows("dark").length === 1, "Tab 切到下一个胶囊：收藏");
    await key("dark", { key: "Tab", shiftKey: true });
    await key("dark", { key: "Tab", shiftKey: true });
    check(selectedChip("dark") === "#设置" && rows("dark").length === 1, "Shift+Tab 往回，从全部绕到最后一个标签");
    await key("dark", { key: "Tab" });
    await key("dark", { key: "ArrowDown" });
    await key("dark", { key: "Enter", shiftKey: true });
    check(calls.includes("paste:t2:plain"), "↓ 选第 2 条，Shift+Enter 粘贴为纯文本");
    await key("dark", { key: "3" });
    check(calls.includes("paste:i1"), "数字键直接粘贴那一行");

    await ctrlClick("dark", 0);
    await ctrlClick("dark", 3);
    check($("dark", ".clipboard-popup__hint--sequence")?.textContent?.includes("已选 2 条") && rows("dark")[3].querySelector(".clipboard-popup__index")?.textContent === "2", "Ctrl+点击挑两条：底栏变色，行首是顺序号");
    await key("dark", { key: "Enter" });
    check(calls.includes("sequence:t1,t3"), "Enter 开始顺序粘贴");
    await key("dark", { key: "Escape" });
    check(!$("dark", ".clipboard-popup__hint--sequence") && !calls.includes("close"), "Esc 先取消挑选，不关窗口");

    await type("dark", "发票");
    check($("dark", ".clipboard-popup__empty strong")?.textContent === "没有匹配「发票」的记录", "没搜到时写出搜的词");
    await type("dark", "");

    await act(async () => { $$("dark", ".clipboard-popup__chip").find((chip) => chip.textContent === "常用语")!.click(); });
    check($("dark", ".clipboard-popup__section") && rows("dark").length === 2 && rows("dark")[0].querySelector(".clipboard-popup__note")?.textContent?.includes("⏎"), "片段页：每个片段一行，第二行是内容");
    await key("dark", { key: "Enter" });
    check(calls.includes("snippet:s1"), "片段页 Enter 粘贴片段");

    check(getComputedStyle($("light", ".clipboard-popup")!).backgroundColor === "rgb(246, 246, 248)", "浅色：浅底");

    const list = $("light", ".clipboard-popup__list")!;
    const listBox = list.getBoundingClientRect();
    const ninth = rows("light")[8].getBoundingClientRect();
    const tenth = rows("light")[9].getBoundingClientRect();
    check(Math.abs(list.clientHeight - 412) <= 1 && ninth.bottom <= listBox.bottom && tenth.top >= listBox.bottom - 8, `列表正好放下 9 行，第 9 行不被切掉（列表高 ${list.clientHeight}）`);
    await act(async () => { rows("light")[9].dispatchEvent(new PointerEvent("pointermove", { bubbles: true })); });
    check(rows("light")[9].classList.contains("clipboard-popup__item--selected") && list.scrollTop === 0, "鼠标移到露在外面的第 10 行只选中它，列表不滚动");
    const callsBefore = calls.length;
    await key("light", { key: "3", metaKey: true, ctrlKey: true });
    check(rows("light")[2].classList.contains("clipboard-popup__item--selected") && $("light", ".clipboard-look") && !calls.slice(callsBefore).some((call) => call.startsWith("paste")),"⌘ 加数字键只选中那一行并预览，不粘贴");
    await key("light", { key: " " });
    const keyUp = (frame: string, init: KeyboardEventInit) => act(async () => {
      $(frame, "input")!.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, ...init }));
    });
    await key("light", { key: " " });
    await key("light", { key: " ", repeat: true });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 420)); });
    check($("light", ".clipboard-look") && $("light", ".clipboard-look__close")?.textContent?.includes("松开关闭"), "按住空格：预览一直开着，提示「松开关闭」，按键重复不会把它关掉");
    await keyUp("light", { key: " " });
    check(!$("light", ".clipboard-look"), "松开空格预览就关上");
    await key("light", { key: " " });
    await keyUp("light", { key: " " });
    check($("light", ".clipboard-look") && $("light", ".clipboard-look__close")?.textContent?.includes("关闭"), "轻按空格：预览留着");
    await key("light", { key: " " });
    check(!$("light", ".clipboard-look"), "再按一次空格关上");
    check($$("wide", ".clipboard-popup__section")[0]?.textContent === "今天", "宽版：列表按今天、昨天、更早分段");

    check($("wide", ".clipboard-popup__pane-body")?.textContent === ITEMS[0].text, "宽版：右边是选中这条的完整内容");
    await key("wide", { key: "ArrowDown" });
    await key("wide", { key: "ArrowDown" });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    check($<HTMLImageElement>("wide", ".clipboard-picture__thumb")?.src.startsWith("data:image/svg") && $<HTMLImageElement>("wide", ".clipboard-picture__full")?.src === "http://fuyu-clip.localhost/i1" && $("wide", ".clipboard-popup__pane-image p")?.textContent?.includes("已不在"), "宽版选中图片：先显示缩略图，原图按记录 id 直接读，下面是识别出的文字");
    await key("wide", { key: "ArrowDown" });
    await key("wide", { key: "ArrowDown" });
    check($("wide", ".clipboard-popup__pane-body")?.textContent?.startsWith("ghp_8f3a••") && !$("wide", ".clipboard-popup__pane")?.textContent?.includes("SECRET"), "宽版：打码的密钥不露原文");
    await key("wide", { key: "ArrowDown" });
    check($$("wide", ".clipboard-popup__pane-files li").length === 3, "宽版：文件逐个列出");

    await checkSecondRound(check, calls);

    await key("paused", { key: " " });
    check(peeks[peeks.length - 1] === "t1" && !$("paused", ".clipboard-look"), "窗口外预览：按空格把选中这条交给外面的预览窗口，列表上不再盖一层");
    await key("paused", { key: "ArrowDown" });
    check(peeks[peeks.length - 1] === "t2:i1", "预览开着时 ↓ 换条，旁边的图片先预取");
    await key("paused", { key: " " });
    check(peeks[peeks.length - 1] === "close" && peeks[peeks.length - 2] === "t2:i1", "再按空格关上外面的预览");

    const press = (target: EventTarget, init: KeyboardEventInit) => act(async () => {
      target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
    });
    const selectedRow = () => rows("light").findIndex((row) => row.classList.contains("clipboard-popup__item--selected"));
    const before = selectedRow();
    (document.activeElement as HTMLElement | null)?.blur();
    await press(document.body, { key: "ArrowDown" });
    check(selectedRow() === before + 1 && document.activeElement === $("light", "input"), "焦点不在列表里（点了标题栏、钉住后点回来）时方向键照样能用，焦点回到搜索框");
    await press($("light", "input")!, { key: "ArrowRight" });
    check(selectedChip("light") === "收藏", "搜索框为空时 → 切到下一个分类");
    await press($("light", "input")!, { key: "ArrowLeft" });
    check(selectedChip("light") === "全部", "← 切回上一个分类");
    await press($("light", "input")!, { key: "k", ctrlKey: true });
    await press($("light", ".clipboard-panel input")!, { key: "ArrowLeft" });
    check(!$("light", ".clipboard-panel"), "Ctrl+K 面板里搜索框为空时 ← 返回列表");
    check($$("light", ".clipboard-popup__delete").length === 1 && $("light", ".clipboard-popup__item--selected .clipboard-popup__delete"), "选中的那行有删除按钮");
    await act(async () => { $("light", ".clipboard-popup__delete")!.click(); });
    check(rows("light").length === ITEMS.length - 1 && $("light", ".clipboard-popup__undo"), "点删除按钮：这条消失，底栏可以撤销");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

const results = document.getElementById("results")!;
if (automated) void runChecks();
else results.textContent = "演示：剪贴板窗口（标准、浅色、宽版）。加 ?test=1 运行检查。";
