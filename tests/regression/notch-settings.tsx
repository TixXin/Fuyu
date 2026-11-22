import { act, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { mockIPC } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/settings/SettingsWindow.css";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { DEFAULT_SETTINGS } from "../../src/lib/settings/settings";
import { defaultNotchRingSettings } from "../../src/lib/settings/notchRingSettings";
import type { IslandSettings } from "../../src/lib/settings/types";
import { NotchSettings } from "../../src/windows/settings/sections/notch/NotchSettings";

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
mockIPC(() => undefined, { shouldMockEvents: true });
const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
window.addEventListener("beforeunload", () => {
  if (savedLocale === null) localStorage.removeItem(LOCALE_STORAGE_KEY);
  else localStorage.setItem(LOCALE_STORAGE_KEY, savedLocale);
});

const START: IslandSettings = { ...DEFAULT_SETTINGS, ...defaultNotchRingSettings(false), accentMode: "pick", accentColor: "#74d6ff" } as IslandSettings;
let current = START;

function Fixture() {
  const [settings, setSettings] = useState(START);
  current = settings;
  return (
    <div className="settings-stage">
      <NotchSettings settings={settings} onSettingsChange={(next) => { current = next; setSettings(next); }} />
    </div>
  );
}

const messages: string[] = [];
const check = (condition: unknown, label: string) => {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
};
const all = <T extends Element>(selector: string, scope: ParentNode = document) => [...scope.querySelectorAll<T>(selector)];
const one = <T extends HTMLElement>(selector: string, scope: ParentNode = document) => {
  const found = scope.querySelector<T>(selector);
  if (!found) throw new Error(`找不到 ${selector}`);
  return found;
};
const click = (element: HTMLElement) => act(async () => { element.click(); });
const option = (group: string, label: string) => {
  const found = all<HTMLButtonElement>(`[role='group'][aria-label='${group}'] button`).find((button) => button.textContent === label);
  if (!found) throw new Error(`找不到「${group}」里的「${label}」`);
  return found;
};
const strip = (label: string) => one<HTMLElement>(`.notch-strip[aria-label='${label}']`);
const preview = () => one<HTMLElement>(".notch-preview .notch-mock");
async function until(ready: () => unknown, label: string) {
  for (let waited = 0; waited < 3000; waited += 50) {
    if (ready()) return;
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
  }
  throw new Error(`等不到：${label}`);
}
const results = document.getElementById("results")!;

const root = createRoot(document.getElementById("root")!);
await act(async () => {
  root.render(<StrictMode><I18nProvider><Fixture /></I18nProvider></StrictMode>);
});

try {
  const titles = all(".settings-row__title").map((title) => title.textContent);
  check(["外框", "内圈", "颜色", "什么时候亮"].every((title) => titles.includes(title)), "外框、内圈、颜色、什么时候亮四行都在");
  check(one(".settings-advanced__toggle").textContent?.includes("细调") && !one<HTMLDetailsElement>(".settings-advanced").open, "粗细、亮度这些收在「细调」里，默认收着");
  check(one(".notch-settings__stage").dataset.search === "off", "预览区不进设置搜索");

  check(all(".notch-strip__item", strip("外框")).length === 7 && all(".notch-strip__item", strip("内圈")).length === 9, "外框 7 种、内圈 9 种样式各有一格");
  check(all(".notch-mock", strip("外框")).length === 6 && all(".notch-mock", strip("内圈")).length === 8, "除了「关」，每种样式都有一张真组件画的缩略图");
  const idle = all(".notch-strip__item:not(.notch-strip__item--active) :is(.notch-rim, .notch-ring)");
  check(idle.length === 14 && idle.every((layer) => /notch-(rim|ring)--paused/.test(layer.className)), "没选中的缩略图停着不动");
  const scan = one<HTMLButtonElement>("[data-style='scan']", strip("内圈"));
  await act(async () => { scan.dispatchEvent(new PointerEvent("pointerover", { bubbles: true })); });
  check(!one(".notch-ring", scan).classList.contains("notch-ring--paused"), "鼠标移到一格上，这一格动起来");
  await act(async () => { scan.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: document.body })); });
  check(one(".notch-ring", scan).classList.contains("notch-ring--paused"), "移开后停回去");

  check(option("预览和修改哪一边", "展开时").getAttribute("aria-pressed") === "true", "收起时什么都没画，一进来先看展开时");
  check(one(".notch-strip__item--active", strip("内圈")).dataset.style === "off" && one(".notch-strip__item--active", strip("外框")).dataset.style === "off", "不是 Mac 时默认两层都关");

  await click(one<HTMLButtonElement>("[data-style='glow']", strip("内圈")));
  check(current.notchRingPanelStyle === "glow" && current.notchRingIslandStyle === "off", "在展开时挑内圈辉光，只改展开时");
  check(preview().querySelector(".notch-ring")?.getAttribute("data-style") === "glow", "预览马上换成辉光");

  await click(option("预览和修改哪一边", "收起时"));
  check(preview().style.height === "32px" && (preview().querySelector(".notch-ring")?.getAttribute("data-style") ?? "off") === "off", "切到收起时，预览是收起的岛，内圈还是关");
  await click(one<HTMLButtonElement>(".notch-settings__link"));
  check(current.notchRimPanelSame && current.notchRingPanelSame, "点「两边一样」，外框和内圈都改成收起展开共用");
  check(one(".notch-settings__caption", strip("外框").closest(".settings-row")!).textContent?.startsWith("收起和展开一起改"), "说明里写清现在两边一起改");
  await click(one<HTMLButtonElement>("[data-style='hairline']", strip("外框")));
  check(current.notchRimIslandStyle === "hairline", "两边一样时改的是收起时那份");
  await click(option("预览和修改哪一边", "展开时"));
  check(one(".notch-strip__item--active", strip("外框")).dataset.style === "hairline", "切到展开时也是发丝");
  await click(one<HTMLButtonElement>(".notch-settings__link"));
  check(!current.notchRimPanelSame && current.notchRimPanelStyle === "hairline" && one(".notch-strip__item--active", strip("外框")).dataset.style === "hairline", "取消「两边一样」后展开时照旧是发丝，不会突然变样");

  await click(one<HTMLButtonElement>(".notch-swatches__swatch--violet"));
  check([current.notchRimIslandColor, current.notchRimPanelColor, current.notchRingIslandColor, current.notchRingPanelColor].every((color) => color === "violet"), "颜色只有一处，外框内圈、收起展开一起变");
  check(one(".notch-swatches__swatch--violet").getAttribute("aria-pressed") === "true", "选中的色块打勾");

  await click(option("什么时候亮", "新消息和 Agent"));
  check(current.notchRingIslandStatus && current.notchRingPanelStatus && current.notchRimIslandStatus && current.notchRimPanelStatus, "打开「新消息和 Agent」，外框和内圈都跟着状态亮");
  await click(option("什么时候亮", "摄像头和麦克风"));
  check(current.notchRingIslandDevice === !START.notchRingIslandDevice && current.notchRingPanelDevice === !START.notchRingPanelDevice, "摄像头和麦克风一个开关管收起展开两边");

  await click(option("试一下", "摄像头"));
  await until(() => preview().querySelector(".notch-mock__lens[data-lit]"), "镜头旁亮绿灯");
  check(preview().querySelector(".notch-ring[data-lit]") || !current.notchRingPanelDevice, "试一下摄像头，预览里的内圈亮起来");
  await click(option("试一下", "摄像头"));
  check(!preview().querySelector(".notch-mock__lens[data-lit]"), "再点一次就停");

  await act(async () => { one<HTMLDetailsElement>(".settings-advanced").open = true; });
  await until(() => document.querySelector("[role='group'][aria-label='粗细']"), "细调展开");
  await click(option("粗细", "粗"));
  check([current.notchRimIslandWidth, current.notchRimPanelWidth, current.notchRingIslandWidth, current.notchRingPanelWidth].every((width) => width === 2.5), "粗细选「粗」，四处都是 2.5");

  await click(option("预览和修改哪一边", "收起时"));
  await click(one<HTMLButtonElement>("[data-style='hairline']", strip("内圈")));
  const flat = preview().style.height;
  await click(option("收起时内圈的底边", "岛加高画整圈"));
  check(flat === "32px" && Number.parseFloat(preview().style.height) > 32 && current.notchRingIslandBottom === "full", "底边选整圈时收起的岛往下长几像素");

  await click(option("预览和修改哪一边", "展开时"));
  await act(async () => { one<HTMLDetailsElement>(".settings-advanced").open = false; });
  await until(() => preview().querySelector(".notch-rim__svg")?.getAttribute("height") === "236", "展开动画停稳后外框量到最终大小");
  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
} catch (error) {
  results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
}
