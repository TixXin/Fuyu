import { act, StrictMode, type CSSProperties } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { JellyfishMark, type JellyMood } from "../../src/components/jellyfish/JellyfishMark";
import { JellyfishStyleContext } from "../../src/components/jellyfish/jellyfishStyleContext";
import { fitPixelGrid } from "../../src/components/jellyfish/pixel/pixelFit";
import { PIXEL_GRIDS } from "../../src/components/jellyfish/pixel/pixelGrids";
import { PIXEL_STYLES } from "../../src/components/jellyfish/pixel/pixelStyles";
import { JELLYFISH_STYLES } from "../../src/lib/settings/settingsLimits";
import type { JellyfishStyle } from "../../src/lib/settings/types";
import { JellyfishStyleArt } from "../../src/windows/settings/island-layout/JellyfishStyleArt";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const MOODS: JellyMood[] = ["idle", "running", "waiting", "failed", "done", "sleep", "stale", "compacting"];
const live = new URLSearchParams(window.location.search).has("live");
const SMALL = [12, 16];
const THEMED = { "--center-jelly-running": "color-mix(in srgb, #ff0000 50%, #0000ff)" } as CSSProperties;
const ROWS: Record<JellyfishStyle, number> = { vector: 0, flat: 12, sticker: 12, mono: 12, neon: 12, chunky: 8, fine: 24 };
const results = document.querySelector<HTMLElement>("#results")!;
const root = createRoot(document.querySelector("#fixture")!);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messages: string[] = [];

function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  messages.push(`PASS ${label}`);
}

function Sheet({ moods }: { moods: Record<JellyfishStyle, JellyMood[]> }) {
  return (
    <>
      {JELLYFISH_STYLES.map((style) => (
        <div key={style} className="jelly-row" data-style={style}>
          <b>{style}</b>
          <JellyfishStyleContext.Provider value={style}>
            <span className="jelly-pill">
              {moods[style].map((mood, index) => <JellyfishMark key={index} mood={mood} paused={!live} height={24} />)}
            </span>
            <span className="jelly-pill island-light">
              <JellyfishMark mood="idle" paused height={24} />
              <JellyfishMark mood="running" paused height={24} />
              <JellyfishMark mood="stale" paused height={24} />
            </span>
            <span className="jelly-pill jelly-small">
              {SMALL.map((size) => <JellyfishMark key={size} mood="running" paused height={size} />)}
            </span>
            <span className="jelly-pill jelly-themed" style={THEMED}>
              <JellyfishMark mood="running" paused height={24} />
            </span>
            <span className="jelly-pill jelly-lively">
              <JellyfishMark mood="idle" lively height={24} />
              <JellyfishMark mood="sleep" lively height={24} />
              <JellyfishMark mood="running" lively height={24} />
            </span>
          </JellyfishStyleContext.Provider>
        </div>
      ))}
      <button type="button" className="jelly-card"><JellyfishStyleArt style="flat" /></button>
    </>
  );
}

const everyMood = () => Object.fromEntries(JELLYFISH_STYLES.map((style) => [style, MOODS])) as Record<JellyfishStyle, JellyMood[]>;

async function show(moods: Record<JellyfishStyle, JellyMood[]>) {
  await act(async () => {
    root.render(<StrictMode><Sheet moods={moods} /></StrictMode>);
    await wait(60);
  });
}

function colours(canvas: HTMLCanvasElement) {
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  const seen = new Set<string>();
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 255) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  return seen;
}

const marks = (style: JellyfishStyle, pill = ".jelly-pill:not(.island-light):not(.jelly-small):not(.jelly-themed):not(.jelly-lively)") => [...document.querySelectorAll<HTMLElement>(`[data-style="${style}"] ${pill} .center-jelly`)];

async function runChecks() {
  try {
    await show(everyMood());
    const vector = marks("vector");
    check(vector.length === MOODS.length && vector.every((mark) => mark.querySelector("svg") && !mark.querySelector("canvas")), "矢量画风还是原来的 SVG 水母");
    const box = vector[0].getBoundingClientRect();

    for (const style of JELLYFISH_STYLES.filter((value) => value !== "vector")) {
      const list = marks(style);
      check(list.length === MOODS.length && list.every((mark) => mark.querySelector("canvas") && !mark.querySelector("svg")), `${style}：八个状态都画在画布上`);
      const sameBox = list.every((mark) => Math.abs(mark.getBoundingClientRect().width - box.width) < 0.01 && mark.getBoundingClientRect().height === box.height);
      check(sameBox, `${style}：占位和矢量水母一样大，不挤动收起条`);
      for (const mark of list) {
        const canvas = mark.querySelector("canvas")!;
        const cell = (Number.parseFloat(canvas.style.height) * window.devicePixelRatio) / canvas.height;
        const across = (Number.parseFloat(canvas.style.width) * window.devicePixelRatio) / canvas.width;
        check(Number.isInteger(cell) && cell >= 1 && cell === across, `${style} ${mark.dataset.mood}：每格是整数个屏幕像素（${cell}）`);
        check(cell * ROWS[style] === 24 * window.devicePixelRatio, `${style} ${mark.dataset.mood}：身体正好 24 像素高`);
      }
    }

    const running = colours(marks("flat")[1].querySelector("canvas")!);
    const waiting = colours(marks("flat")[2].querySelector("canvas")!);
    check(running.has("109,182,244") && waiting.has("255,205,60"), "身体颜色跟着状态：运行蓝、等你黄");
    check(colours(marks("flat")[0].querySelector("canvas")!).has("246,227,211"), "深色岛上空闲是米白");
    check(colours(marks("flat")[6].querySelector("canvas")!).has("169,173,184") && colours(marks("flat")[7].querySelector("canvas")!).has("109,182,244"), "可能中断是灰色，压缩上下文和运行一样是蓝色");
    check(colours(marks("flat", ".island-light")[2].querySelector("canvas")!).has("143,147,160"), "浅色岛上可能中断的灰色深一档");
    const fills = [6, 7].map((index) => window.getComputedStyle(vector[index].querySelector(".center-jelly-fill")!).fill);
    check(fills[0] === "rgb(169, 173, 184)" && fills[1] === "rgb(109, 182, 244)", "矢量水母的这两个状态用同样的颜色");
    check(vector[6].querySelector(".center-jelly-ask") && vector[7].querySelector(".center-jelly-press"), "矢量水母：可能中断带问号，压缩上下文带往里挤的箭头");
    const lightIdle = colours(marks("flat", ".island-light")[0].querySelector("canvas")!);
    check(lightIdle.has("236,220,200") && lightIdle.has("180,157,130"), "浅色岛上空闲换成暖米色并补一圈棕边");
    check(colours(marks("mono", ".island-light")[0].querySelector("canvas")!).has("184,159,130"), "单色在浅色岛上空闲用深一点的棕色");
    check(!colours(marks("mono")[1].querySelector("canvas")!).has("29,27,34"), "单色不画黑眼睛，眼睛是镂空的");
    check(colours(marks("sticker")[1].querySelector("canvas")!).size > running.size, "描边比扁平多一圈深色");

    for (const style of JELLYFISH_STYLES.filter((value): value is Exclude<JellyfishStyle, "vector"> => value !== "vector")) {
      marks(style, ".jelly-small").forEach((mark, index) => {
        const canvas = mark.querySelector("canvas")!;
        const cell = (Number.parseFloat(canvas.style.height) * window.devicePixelRatio) / canvas.height;
        const rows = PIXEL_STYLES[style].grids.map((key) => PIXEL_GRIDS[key].height);
        const fit = fitPixelGrid(SMALL[index], window.devicePixelRatio, rows);
        const body = (cell * rows[fit.index]) / window.devicePixelRatio;
        check(Number.isInteger(cell) && cell === fit.cell, `${style} ${SMALL[index]}px：每格还是整数个屏幕像素（${cell}）`);
        check(body <= SMALL[index] * 1.25 && body >= SMALL[index] * 0.66, `${style} ${SMALL[index]}px：身体 ${body} 像素高，没有撑出占位太多，也没小到看不清`);
      });
    }
    const neonLight = marks("neon", ".island-light")[1].querySelector("canvas")!;
    const neonData = neonLight.getContext("2d")!.getImageData(0, 0, neonLight.width, neonLight.height).data;
    let faint = 0;
    for (let i = 3; i < neonData.length; i += 4) if (neonData[i] === 77) faint += 1;
    const neonLines = [...colours(neonLight)].map((value) => value.split(",").map(Number));
    check(faint === 0 && neonLines.some(([red, green, blue]) => red < 109 && green < 182 && blue < 244 && blue > green && green > red), "霓虹在浅色岛上不画半透明的光圈，轮廓比身体色深");
    const themed = [...colours(marks("flat", ".jelly-themed")[0].querySelector("canvas")!)].map((value) => value.split(",").map(Number));
    check(themed.some(([red, green, blue]) => Math.abs(red - 128) <= 1 && green === 0 && Math.abs(blue - 128) <= 1), "主题把状态色写成 color-mix() 时照样画对颜色");

    const card = document.querySelector<HTMLButtonElement>(".jelly-card")!;
    const shown = () => card.querySelector<HTMLElement>(".center-jelly")!.dataset.mood;
    check(shown() === "idle" && card.querySelector(".center-jelly canvas"), "设置里的画风卡片平时画空闲的样子");
    await act(async () => { card.dispatchEvent(new PointerEvent("pointerenter")); });
    check(shown() === "running", "鼠标停在卡片上，先演运行");
    let toured = false;
    for (let spent = 0; spent < 4000 && !toured; spent += 50) {
      await act(async () => { await wait(50); });
      toured = shown() === "waiting";
    }
    check(toured, "过一会儿换到下一个状态（等你）");
    await act(async () => { card.dispatchEvent(new PointerEvent("pointerleave")); });
    check(shown() === "idle", "鼠标移开回到空闲");

    const settle = async (done: () => boolean) => {
      for (let spent = 0; spent < 4000 && !done(); spent += 50) await act(async () => { await wait(50); });
      return done();
    };
    const inkLeft = (canvas: HTMLCanvasElement) => {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let left = canvas.width;
      for (let i = 0; i < data.length; i += 4) if (data[i] === 29 && data[i + 1] === 27 && data[i + 2] === 34 && data[i + 3] === 255) left = Math.min(left, (i / 4) % canvas.width);
      return left;
    };
    const moveTo = (x: number, y: number) => act(async () => { window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y })); });
    for (const style of ["vector", "flat"] as const) {
      const lively = () => marks(style, ".jelly-lively");
      const moods = () => lively().map((mark) => mark.dataset.mood).join(" ");
      const pokable = lively().map((mark) => mark.classList.contains("center-jelly--lively"));
      check(pokable[0] && pokable[1] && !pokable[2] && marks(style).every((mark) => !mark.classList.contains("center-jelly--lively")), `${style}：面板里空闲和睡着的水母能点，正在演 Agent 状态的和收起条上的不能`);
      await act(async () => { lively().forEach((mark) => mark.click()); });
      check(moods() === "done waiting running", `${style}：点一下，空闲的开心一下，睡着的惊醒，运行中的不理`);
      check(await settle(() => moods() === "idle sleep running"), `${style}：过一会儿回到原来的样子`);

      const box = lively()[0].getBoundingClientRect();
      const middle = box.top + box.height / 2;
      await moveTo(box.right + 200, middle);
      if (style === "vector") {
        check(lively()[0].style.getPropertyValue("--center-jelly-look-x") === "1" && window.getComputedStyle(lively()[0].querySelector(".center-jelly-eye")!).translate !== "none", "vector：鼠标在右边，空闲的眼睛往右挪");
        check(!lively()[1].style.getPropertyValue("--center-jelly-look-x"), "vector：睡着的不看鼠标");
      } else {
        const rows = PIXEL_STYLES[style].grids.map((key) => PIXEL_GRIDS[key].height);
        const step = PIXEL_GRIDS[PIXEL_STYLES[style].grids[fitPixelGrid(24, window.devicePixelRatio, rows).index]].step;
        const rest = inkLeft(marks(style)[0].querySelector("canvas")!);
        check(await settle(() => inkLeft(lively()[0].querySelector("canvas")!) === rest + step), `${style}：鼠标在右边，空闲的眼睛往右挪一格`);
      }
      await moveTo(box.left + box.width / 2, middle);
      if (style === "vector") check(!lively()[0].style.getPropertyValue("--center-jelly-look-x"), "vector：鼠标回到水母身上，眼睛回正");
      await moveTo(box.left - 200, middle - 200);
      await act(async () => { document.documentElement.dispatchEvent(new PointerEvent("pointerleave")); });
      if (style === "vector") check(!lively()[0].style.getPropertyValue("--center-jelly-look-x"), "vector：鼠标离开窗口，眼睛回正");
      else check(await settle(() => inkLeft(lively()[0].querySelector("canvas")!) === inkLeft(marks(style)[0].querySelector("canvas")!)), `${style}：鼠标离开窗口，眼睛回正`);
    }

    const swapped = everyMood();
    swapped.flat = ["done", "failed", "idle", "sleep", "running", "waiting", "compacting", "stale"];
    await show(swapped);
    const afterSwap = marks("flat").map((mark) => colours(mark.querySelector("canvas")!));
    check(afterSwap[0].has("94,214,158") && afterSwap[1].has("242,85,76") && afterSwap[4].has("109,182,244"), "状态变了立刻重画成新状态的颜色");
    await show(everyMood());

    results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
    results.dataset.result = "passed";
  } catch (error) {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  }
}

if (live) await show(everyMood());
else await runChecks();
