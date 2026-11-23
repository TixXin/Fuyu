import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles/tokens.css";
import { JellyfishMark, type JellyMood } from "../../src/components/jellyfish/JellyfishMark";
import { JellyfishStyleContext } from "../../src/components/jellyfish/jellyfishStyleContext";
import { JELLYFISH_STYLES } from "../../src/lib/settings/settingsLimits";
import type { JellyfishStyle } from "../../src/lib/settings/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const MOODS: JellyMood[] = ["idle", "running", "waiting", "failed", "done", "sleep"];
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
              {moods[style].map((mood, index) => <JellyfishMark key={index} mood={mood} paused height={24} />)}
            </span>
            <span className="jelly-pill island-light">
              <JellyfishMark mood="idle" paused height={24} />
              <JellyfishMark mood="running" paused height={24} />
            </span>
          </JellyfishStyleContext.Provider>
        </div>
      ))}
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

const marks = (style: JellyfishStyle, pill = ".jelly-pill:not(.island-light)") => [...document.querySelectorAll<HTMLElement>(`[data-style="${style}"] ${pill} .center-jelly`)];

async function runChecks() {
  try {
    await show(everyMood());
    const vector = marks("vector");
    check(vector.length === 6 && vector.every((mark) => mark.querySelector("svg") && !mark.querySelector("canvas")), "矢量画风还是原来的 SVG 水母");
    const box = vector[0].getBoundingClientRect();

    for (const style of JELLYFISH_STYLES.filter((value) => value !== "vector")) {
      const list = marks(style);
      check(list.length === 6 && list.every((mark) => mark.querySelector("canvas") && !mark.querySelector("svg")), `${style}：六个状态都画在画布上`);
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
    const lightIdle = colours(marks("flat", ".island-light")[0].querySelector("canvas")!);
    check(lightIdle.has("236,220,200") && lightIdle.has("180,157,130"), "浅色岛上空闲换成暖米色并补一圈棕边");
    check(colours(marks("mono", ".island-light")[0].querySelector("canvas")!).has("184,159,130"), "单色在浅色岛上空闲用深一点的棕色");
    check(!colours(marks("mono")[1].querySelector("canvas")!).has("29,27,34"), "单色不画黑眼睛，眼睛是镂空的");
    check(colours(marks("sticker")[1].querySelector("canvas")!).size > running.size, "描边比扁平多一圈深色");

    const swapped = everyMood();
    swapped.flat = ["done", "failed", "idle", "sleep", "running", "waiting"];
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

await runChecks();
