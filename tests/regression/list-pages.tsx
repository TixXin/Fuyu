import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { ClipboardHistoryPanel } from "../../src/features/clipboard/ClipboardHistoryPanel";
import type { ClipboardHistoryItem, ClipboardHistorySnapshot } from "../../src/features/clipboard/api";
import { FileShelfPanel } from "../../src/features/file-shelf/FileShelfPanel";
import type { FileShelfItem } from "../../src/features/file-shelf/api";
import type { FileShelfController } from "../../src/features/file-shelf/useFileShelf";

const automated = new URLSearchParams(location.search).has("test");
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: automated });
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
mockIPC(() => null);
const copiedTexts: string[] = [];
Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { copiedTexts.push(value); } } });

const now = Date.now();
const minute = 60_000;
const thumb = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="40" height="40" fill="url(#g)"/></svg>`)}`;
const base = { hash: "", createdAt: now, favorite: false } as const;
const ITEMS: ClipboardHistoryItem[] = [
  { ...base, id: "t1", kind: "text", copiedAt: now - 20_000, preview: "主题从此不包含尺寸和显示内容，可以吗", source: { path: "C:\\code.exe", name: "VS Code" } },
  { ...base, id: "t2", kind: "text", copiedAt: now - 2 * minute, preview: "pnpm test:regression clipboard && git status --short", favorite: true, source: { path: "C:\\wt.exe", name: "Windows Terminal" } },
  { ...base, id: "i1", kind: "image", copiedAt: now - 5 * minute, preview: "770 x 148 image", ocrText: "已不在", image: { width: 770, height: 148, byteSize: 1, originalPath: "", thumbnailPath: "", thumbnailDataUrl: thumb("#2a3350", "#c75b7a") }, source: { path: "C:\\weixin.exe", name: "微信" } },
  { ...base, id: "t3", kind: "text", copiedAt: now - 12 * minute, preview: "题市场放在「扩展」组和插件市场挨着，还是放在「基础」组紧跟「主题」？这句故意写长，看两行之后是否截断。", tags: ["设置"], note: "#设置 待定", source: { path: "C:\\msedge.exe", name: "Edge" } },
  { ...base, id: "t4", kind: "text", copiedAt: now - 20 * minute, preview: "ghp_8f3a••••••••••••••••", masked: true },
  { ...base, id: "f1", kind: "files", copiedAt: now - 70 * minute, preview: "release-notes-0.3.5.md", files: ["a", "b", "c"], source: { path: "C:\\explorer.exe", name: "资源管理器" } },
  { ...base, id: "i2", kind: "image", copiedAt: now - 26 * 60 * minute, preview: "1352 x 1114 image", note: "设置窗口参考", image: { width: 1352, height: 1114, byteSize: 1, originalPath: "", thumbnailPath: "", thumbnailDataUrl: thumb("#0d1424", "#1d2f54") } },
  { ...base, id: "c1", kind: "text", copiedAt: now - 27 * 60 * minute, preview: "#3b82f6", source: { path: "C:\\figma.exe", name: "Figma" } },
  { ...base, id: "l1", kind: "text", copiedAt: now - 28 * 60 * minute, preview: "https://github.com/TixXin/fuyu/pull/26", source: { path: "C:\\weixin.exe", name: "微信" } },
];
const SHELF: FileShelfItem[] = [
  { id: "s1", path: "D:\\Work\\Design\\设计稿-v3.fig", name: "设计稿-v3.fig", isDir: false, size: 18_400_000, addedAt: now, pinned: true, missing: false, unreachable: false },
  { id: "s2", path: "C:\\Users\\me\\Desktop\\周报-2026-11-09.docx", name: "周报-2026-11-09.docx", isDir: false, size: 86_000, addedAt: now, pinned: false, missing: false, unreachable: false },
  { id: "s3", path: "C:\\Users\\me\\Downloads\\fly-island-screenshots", name: "fly-island-screenshots", isDir: true, size: 0, addedAt: now, pinned: false, missing: false, unreachable: false },
  { id: "s4", path: "E:\\Projects\\fly-island\\docs\\assets\\demo-preview.gif", name: "demo-preview.gif", isDir: false, size: 3_100_000, addedAt: now, pinned: false, missing: false, unreachable: false },
  { id: "s5", path: "C:\\Users\\me\\Downloads\\old-installer.exe", name: "old-installer.exe", isDir: false, size: 0, addedAt: now, pinned: false, missing: true, unreachable: false },
  { id: "s6", path: "\\\\NAS\\共享\\合同扫描.pdf", name: "合同扫描.pdf", isDir: false, size: 0, addedAt: now, pinned: false, missing: false, unreachable: true },
];

const calls: string[] = [];
let items = ITEMS;
const snapshot = (): ClipboardHistorySnapshot => ({
  settings: { shortcutEnabled: true, shortcut: "Ctrl+Shift+W" } as ClipboardHistorySnapshot["settings"],
  items,
});
const shelf = (list: FileShelfItem[]): FileShelfController => ({
  items: list, error: null, recentDrop: null,
  refresh: async () => {}, addPaths: async () => {}, startDrag: async () => {}, isDraggingOut: () => false,
  remove: async (ids: string[]) => { calls.push(`remove:${ids.join()}`); },
  togglePin: async (id: string) => { calls.push(`pin:${id}`); },
  clear: async () => {},
  copy: async (ids: string[]) => { calls.push(`shelf-copy:${ids.join()}`); return true; },
  open: async (id: string) => { calls.push(`open:${id}`); },
  reveal: async (id: string) => { calls.push(`reveal:${id}`); },
} as unknown as FileShelfController);

const roots: ReturnType<typeof createRoot>[] = [];
function renderAll() {
  const clip = <ClipboardHistoryPanel
    snapshot={snapshot()}
    onCopyItem={(id, copyAs) => { calls.push(`copy:${id}${copyAs && copyAs !== "original" ? `:${copyAs}` : ""}`); return true; }}
    onToggleFavorite={(id) => { calls.push(`star:${id}`); }}
    onUpdateNote={() => true}
    onDeleteItem={(id) => { calls.push(`delete:${id}`); items = items.filter((item) => item.id !== id); renderAll(); }}
    onClear={() => {}}
  />;
  const pages = [clip, clip, <FileShelfPanel shelf={shelf(SHELF)} isDropTarget={false} revealOnDoubleClick={false} />, <FileShelfPanel shelf={shelf(SHELF)} isDropTarget={false} revealOnDoubleClick={false} />, <FileShelfPanel shelf={shelf([])} isDropTarget={false} revealOnDoubleClick={false} />];
  ["clip-dark", "clip-light", "shelf-dark", "shelf-light", "shelf-empty"].forEach((id, index) => {
    roots[index] ??= createRoot(document.getElementById(id)!);
    roots[index].render(<StrictMode><I18nProvider>{pages[index]}</I18nProvider></StrictMode>);
  });
}

const messages: string[] = [];
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}
const $ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document) => [...root.querySelectorAll<T>(selector)];
const click = (element: Element | null | undefined) => act(async () => { (element as HTMLElement | null)?.click(); });
const chip = (root: ParentNode, label: string) => $$("button.island-list-chip", root).find((button) => button.textContent === label);
const menuItem = (label: string) => $$("button.row-menu__item").find((button) => button.textContent?.includes(label));
const row = (root: ParentNode, id: string) => $(`[data-clipboard-id="${id}"], [data-shelf-id="${id}"]`, root) ?? $$(".island-list-row", root).find((item) => item.textContent?.includes(id));

async function runChecks() {
  try {
    await act(async () => renderAll());
    const clip = document.getElementById("clip-dark")!;
    const first = row(clip, "t1")!;
    check(getComputedStyle(first).backgroundColor === "rgba(0, 0, 0, 0)" && getComputedStyle(clip.querySelector(".island-list-page")!).backgroundImage === "none", "剪贴板页不套卡片，行静止时没有底色");
    check(getComputedStyle($(".island-list-row__actions", first)!).display === "none", "按钮只在悬停或选中时出现");
    check($$(".island-list-row", clip).length === ITEMS.length, "每条记录一行");
    check($(".island-list-row__meta", first)?.textContent?.includes("VS Code") && $(".island-list-row__meta", first)?.textContent?.includes("刚刚"), "第二行写来源程序和时间");
    const image = $$(".island-list-row", clip)[2];
    check($(".island-list-row__main", image)?.textContent === "图片 770×148" && $("img", image), "图片写成「图片 宽×高」，行首是缩略图");
    check($(".island-list-search kbd", clip)?.textContent === "Ctrl+Shift+W", "搜索框一直显示，带打开剪贴板的快捷键");
    const list = $(".island-list", clip)!;
    const short = $$(".island-list-row", clip).filter((item) => item.getBoundingClientRect().height + 0.5 < $(".island-list-row__text", item)!.getBoundingClientRect().height + 14);
    check(list.scrollHeight > list.clientHeight && short.length === 0, "列表要滚动时，两行的记录也不被压矮、不压到相邻的行");

    await click($(".island-list-row__hit", first));
    check(calls.includes("copy:t1"), "点一行就复制");
    check($(".island-list-row__meta--accent", first)?.textContent === "已复制", "复制后第二行显示「已复制」");

    await click(chip(clip, "图片"));
    check($$(".island-list-row", clip).length === 2, "「图片」只列图片");
    await click(chip(clip, "#设置"));
    check($$(".island-list-row", clip).length === 1 && ($(".island-list-search input", clip) as HTMLInputElement).value === "#设置", "常用标签在筛选行，点它只看这个标签");
    await click(chip(clip, "全部"));
    check($$(".island-list-row", clip).length === ITEMS.length && ($(".island-list-search input", clip) as HTMLInputElement).value === "", "回到「全部」清掉标签搜索");

    const imageMenu = $$(".island-list-row", clip)[2];
    await click($('button[aria-haspopup="menu"]', imageMenu));
    check(menuItem("复制为文件") && menuItem("复制图片路径") && menuItem("识别出的文字"), "图片的「⋯」有复制为文件、路径和识别出的文字");
    await click(menuItem("复制为文件"));
    check(calls.includes("copy:i1:file") && !$(".row-menu"), "菜单项执行后菜单关闭");
    await click($('button[aria-haspopup="menu"]', $$(".island-list-row", clip)[0]));
    await click(menuItem("删除剪贴记录"));
    check(menuItem("再点一次删除") && !calls.includes("delete:t1"), "删除先要再点一次确认");
    await click(menuItem("再点一次删除"));
    check(calls.includes("delete:t1") && !row(clip, "t1"), "确认后删除");

    const color = row(clip, "c1")!;
    check($(".clipboard-swatch", color) && $(".island-list-row__meta", color)?.textContent?.startsWith("颜色"), "颜色：行首是色块，第二行标「颜色」");
    check($(".island-list-row__main", row(clip, "l1")!)?.textContent === "github.com › TixXin/fuyu › pull/26", "链接写成「域名 › 路径」");
    const search = $<HTMLInputElement>(".island-list-search input", clip)!;
    const type = (value: string) => act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(search, value);
      search.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await type("kzz");
    check($$(".island-list-row", clip).length === 1 && $$(".island-list-row", clip)[0].textContent?.includes("「扩展」组"), "拼音首字母 kzz 搜到「扩展」组");
    await type("/app:微信");
    check($$(".island-list-row", clip).length === 2, "/app:微信 只看微信复制的");
    await type("/color");
    check($$(".island-list-row", clip).length === 1, "/color 只看颜色");
    await type("");

    const command = row(clip, "t2")!;
    await click($('button[aria-haspopup="menu"]', command));
    check(menuItem("转换后复制") && menuItem("AI 改写后复制"), "文字的「⋯」有转换和 AI 改写");
    await click(menuItem("转换后复制"));
    check($(".clipboard-island-tools .clipboard-panel__result span", clip)?.textContent === "复制的会是", "转换页盖在列表上，写「复制的会是」");
    await click($$(".clipboard-panel__action", clip).find((button) => button.textContent?.includes("全部大写")));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    check(copiedTexts.includes("PNPM TEST:REGRESSION CLIPBOARD && GIT STATUS --SHORT") && !$(".clipboard-island-tools", clip), "选一个转换就复制结果并关掉");
    check($(".island-list-row__meta--accent", row(clip, "t2")!)?.textContent === "已复制", "复制后这一行显示「已复制」");
    await click($('button[aria-haspopup="menu"]', row(clip, "t4")!));
    check(menuItem("转换后复制") && !menuItem("AI 改写后复制"), "打码的密钥不能发给 AI");
    await click($('button[aria-haspopup="menu"]', row(clip, "t4")!));

    const shelfPage = document.getElementById("shelf-dark")!;
    const desk = row(shelfPage, "s2")!;
    check(/^C:\\Users\\me\\Desktop· \d+ KB$/.test($(".island-list-row__meta", desk)?.textContent ?? ""), "文件中转第二行写所在文件夹和大小");
    check($(".island-list-row__mark", row(shelfPage, "s1")!), "置顶的文件行尾有图钉");
    check($(".island-list-row__warn", row(shelfPage, "s6")!)?.textContent?.includes("无法访问"), "无法访问用琥珀色写出");
    await click($(".island-list-row__hit", desk));
    check(desk.classList.contains("island-list-row--selected"), "点文件选中它");
    await click($('button[aria-haspopup="menu"]', desk));
    await click(menuItem("打开"));
    check(calls.includes("open:s2"), "「⋯」里的「打开」打开文件");
    await click(chip(shelfPage, "置顶"));
    check($$(".island-list-row", shelfPage).length === 1, "「置顶」只列置顶的文件");
    const empty = document.getElementById("shelf-empty")!;
    check($(".island-list-empty strong", empty)?.textContent === "把文件拖到岛上暂存" && $(".island-list-empty small", empty), "空的时候是图标加两行说明");

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

const results = document.getElementById("results")!;
if (automated) void runChecks();
else {
  renderAll();
  results.textContent = "演示：剪贴板（深色、浅色）、文件中转（深色、浅色、空）。加 ?test=1 运行检查。";
}
