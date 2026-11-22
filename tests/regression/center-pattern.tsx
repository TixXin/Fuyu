import { act, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "../../src/styles/tokens.css";
import type { PetInfo } from "../../src/features/center-pattern/api";
import type { CenterPatternId, PetMood } from "../../src/features/center-pattern/patterns";
import type { AgentActivity } from "../../src/features/center-pattern";

const OWNER = "center-pattern";
const MOODS: PetMood[] = ["idle", "running", "waiting", "failed", "done"];
const params = new URLSearchParams(location.search);
const petsBase = params.get("petsBase") ?? "/node_modules/.cache/codex-pets";
const petIds = (params.get("pets") ?? "").split(",").filter(Boolean);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function syntheticSheet(rows = 9): string {
  const canvas = document.createElement("canvas");
  canvas.width = 8 * 192;
  canvas.height = rows * 208;
  const context = canvas.getContext("2d")!;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      context.fillStyle = `hsl(${row * 40} 70% ${col % 2 ? 62 : 74}%)`;
      context.beginPath();
      context.arc(col * 192 + 96, row * 208 + 104, 80, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#111";
      context.font = "bold 90px sans-serif";
      context.textAlign = "center";
      context.fillText(String(col), col * 192 + 96, row * 208 + 136);
    }
  }
  return canvas.toDataURL("image/png");
}

const SHEET = syntheticSheet();

Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const trackingCalls: boolean[] = [];
const configCalls: { id: string; key: string; value: unknown }[] = [];
let centerPlugin = { enabled: true, config: { pattern: "eyes", pet: "" } as Record<string, unknown> };
const petList: PetInfo[] = [
  { id: "xiaoba", displayName: "小八", source: "codex" },
  { id: "synthetic", displayName: "Synthetic", source: "app" },
];
const builtinReply = () => [{ id: OWNER, kind: "builtin" as const, enabled: centerPlugin.enabled, background: [], config: { ...centerPlugin.config } }];

mockIPC((command, payload) => {
  const args = (payload ?? {}) as Record<string, unknown>;
  if (command === "set_island_cursor_tracking") trackingCalls.push(Boolean(args.enabled));
  if (command === "get_builtin_plugins") return builtinReply();
  if (command === "set_builtin_plugin_config") {
    const id = String(args.id);
    const key = String(args.key);
    const value = args.value ?? null;
    configCalls.push({ id, key, value });
    if (value === null) delete centerPlugin.config[key];
    else centerPlugin.config[key] = value;
    return builtinReply();
  }
  if (command === "list_pets") return petList;
  if (command === "get_pet_spritesheet") {
    const id = String(args.id);
    if (id === "synthetic" || id === "xiaoba") return SHEET;
    if (petIds.includes(id)) return `${petsBase}/${id}/spritesheet.webp`;
    throw new Error(`no pet ${id}`);
  }
  return null;
}, { shouldMockEvents: true });
mockWindows("main");

const { CenterPattern } = await import("../../src/features/center-pattern/CenterPattern");
const { CenterPatternSettingsGroup } = await import("../../src/features/center-pattern/CenterPatternSettingsGroup");
const { PetSprite } = await import("../../src/features/center-pattern/PetSprite");
const { ISLAND_CURSOR_MOVED_EVENT } = await import("../../src/lib/island-cursor/api");
const { CENTER_PATTERNS } = await import("../../src/features/center-pattern/patterns");
const { useCenterDecor } = await import("../../src/features/center-pattern/useCenterDecor");
const { useStatusLightDecor } = await import("../../src/features/center-pattern/useStatusLightDecor");
await import("../../src/features/center-pattern/plugin/island");
await import("../../src/features/center-pattern/plugin/runners");
const { defineSlot } = await import("../../src/features/plugin-kernel/slots");
const { BUILTIN_PLUGINS_CHANGED } = await import("../../src/features/plugin-kernel/api");
const { useBuiltinConfig, useBuiltinEnabled } = await import("../../src/features/plugin-kernel/useBuiltinPlugins");
const { I18nProvider } = await import("../../src/i18n");
await import("../../src/windows/island/IslandCollapsedBar.css");

const fixture = document.getElementById("fixture")!;
const results = document.getElementById("results")!;
const messages: string[] = [];
const root = createRoot(fixture);

function Slot({ agents = [], paused = false, markLight = false }: { agents?: AgentActivity[]; paused?: boolean; markLight?: boolean }) {
  const enabled = useBuiltinEnabled(OWNER);
  const config = useBuiltinConfig(OWNER);
  const center = useCenterDecor({ paused, agents, markLight, enabled, settings: config });
  const light = useStatusLightDecor({ paused, agents, markLight });
  const slots = { ...center, ...light };
  return <div className="cp-island cp-slot">
    {slots.statusLight ? <span className="cp-light">{slots.statusLight}</span> : null}
    {slots.center ? <span className="island__center-slot">{slots.center}</span> : null}
    {slots.agentIcon ? <span className="cp-agent-icon">{slots.agentIcon}</span> : null}
  </div>;
}

function Gallery({ paused, mood }: { paused: boolean; mood?: PetMood }) {
  const pets = petIds.length ? petIds.map((id) => ({ id, src: `${petsBase}/${id}/spritesheet.webp` })) : [{ id: "synthetic", src: SHEET }];
  return (
    <>
      <section className="cp-section">
        <h2>内置图案（折叠岛 38px 高，图案 22px）</h2>
        <div className="cp-row">
          {CENTER_PATTERNS.map((pattern: CenterPatternId) => (
            <div className="cp-cell" key={pattern} data-cell={pattern}>
              <div className="cp-island"><CenterPattern pattern={pattern} paused={paused} /></div>
              {pattern}
            </div>
          ))}
        </div>
      </section>
      <section className="cp-section">
        <h2>放大 3 倍</h2>
        <div className="cp-row cp-zoom" style={{ justifyContent: "center" }}>
          {CENTER_PATTERNS.map((pattern) => (
            <div className="cp-island cp-small" key={pattern}><CenterPattern pattern={pattern} paused={paused} /></div>
          ))}
        </div>
      </section>
      <section className="cp-section">
        <h2>水母随 Agent 状态（放大 3 倍）：idle / running / waiting / failed / done</h2>
        <div className="cp-row cp-zoom">
          {(mood ? [mood] : MOODS).map((markMood) => (
            <div className="cp-island cp-small" key={markMood} data-mark={markMood}><CenterPattern pattern="mark" mood={markMood} paused={paused} /></div>
          ))}
        </div>
      </section>
      {pets.map((pet) => (
        <section className="cp-section" key={pet.id}>
          <h2>宠物 {pet.id}：idle / running / waiting / failed / done</h2>
          <div className="cp-row">
            {(mood ? [mood] : MOODS).map((petMood) => (
              <div className="cp-cell" key={petMood}>
                <div className="cp-island cp-small"><PetSprite src={pet.src} mood={petMood} paused={paused} /></div>
                {petMood}
              </div>
            ))}
            <div className="cp-cell">
              <div className="cp-island cp-small" style={{ height: 76 }}><PetSprite src={pet.src} mood="running" height={66} paused={paused} /></div>
              running 66px
            </div>
          </div>
        </section>
      ))}
    </>
  );
}

const render = async (node: ReactNode) => {
  await act(async () => {
    root.render(<StrictMode>{node}</StrictMode>);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
};
const waitFor = async (check: () => boolean, label: string) => {
  for (let i = 0; i < 100 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  if (!check()) throw new Error(label);
};
const syncSwitch = async (enabled: boolean, config: Record<string, unknown>) => {
  centerPlugin = { enabled, config: { ...config } };
  await act(async () => { await emit(BUILTIN_PLUGINS_CHANGED, builtinReply()); });
};

async function runChecks() {
  const pass = (label: string) => messages.push(`PASS ${label}`);
  const expect = (ok: boolean, label: string) => { if (!ok) throw new Error(label); pass(label); };
  const slotWith = async (config: Record<string, unknown>, agents: AgentActivity[] = [], enabled = true) => {
    await syncSwitch(enabled, config);
    await render(<Slot key={JSON.stringify([config, agents, enabled])} agents={agents} />);
  };

  await slotWith({ pattern: "bird", pet: "" });
  await waitFor(() => fixture.querySelector(".cp-slot [data-pattern=bird]") !== null, "槽位显示所选图案");
  pass("插件启用时折叠栏中心槽位显示所选图案（小鸟）");
  await slotWith({ pattern: "pet", pet: "synthetic" }, [{ phase: "waiting", updatedAt: Date.now() }]);
  await waitFor(() => fixture.querySelector(".cp-slot .pet-sprite") !== null, "槽位显示宠物");
  const slotPet = fixture.querySelector<HTMLElement>(".cp-slot .pet-sprite")!;
  expect(slotPet.dataset.mood === "waiting" && Math.round(slotPet.getBoundingClientRect().height) === 28, "槽位宠物 28px 高，有会话等待确认时演 waiting");
  const iconPet = fixture.querySelector<HTMLElement>(".cp-agent-icon .pet-sprite");
  expect(iconPet?.dataset.mood === "waiting" && Math.round(iconPet.getBoundingClientRect().height) === 18 && iconPet.getBoundingClientRect().width < 17,
    "选宠物时同时给出 Agent 标题前的图标：18px 高、不比 16px 图标占位宽多少，跟随 mood");
  await slotWith({ pattern: "pet", pet: "gone" });
  await waitFor(() => fixture.querySelector(".cp-slot [data-pattern=eyes]") !== null, "宠物读不到时退回眼睛");
  pass("宠物不存在或读取失败时退回眼睛，不留空白");
  expect(!fixture.querySelector(".cp-agent-icon"), "宠物读不到时不替换 Agent 图标");
  await slotWith({ pattern: "bird", pet: "" });
  await waitFor(() => fixture.querySelector(".cp-slot [data-pattern=bird]") !== null, "内置图案");
  expect(!fixture.querySelector(".cp-agent-icon"), "内置 SVG 图案不替换 Agent 图标");
  await slotWith({ pattern: "cat", pet: "" }, [], false);
  expect(fixture.querySelector(".cp-slot")!.childElementCount === 0, "插件关闭时不填槽位");

  const markIn = (agents: AgentActivity[]) => slotWith({ pattern: "mark", pet: "" }, agents)
    .then(() => fixture.querySelector<HTMLElement>(".cp-slot .center-jelly")!);
  const bodyColor = (jelly: HTMLElement) => getComputedStyle(jelly).getPropertyValue("--center-jelly-fill").trim().toLowerCase();
  let mark = await markIn([]);
  expect(mark.dataset.mood === "idle" && bodyColor(mark) === "#f6e3d3" && mark.querySelectorAll(".center-jelly-lobe").length === 4,
    "水母空闲：米白身体、四瓣触手");
  expect(getComputedStyle(mark.querySelector(".center-jelly-body")!).animationName === (reducedMotion ? "none" : "center-jelly-lift"),
    reducedMotion ? "减弱动态时水母不动" : "水母空闲时定时游一下");
  const jelly = (selector: string) => fixture.querySelector(`${selector} .center-jelly svg`)?.getBoundingClientRect();
  const centerJelly = jelly(".cp-slot .island__center-slot");
  const iconJelly = jelly(".cp-agent-icon");
  expect(centerJelly !== undefined && Math.abs(centerJelly.height - 24) < 0.6 && iconJelly !== undefined && Math.abs(iconJelly.height - 24) < 0.6,
    `水母 24px 高（中心 ${centerJelly?.height.toFixed(1)}px、标题前 ${iconJelly?.height.toFixed(1)}px），和环一样`);
  mark = await markIn([{ phase: "running", updatedAt: Date.now() }]);
  expect(mark.dataset.mood === "running" && bodyColor(mark) === "#6db6f4", "水母运行时变蓝");
  mark = await markIn([{ phase: "waiting", updatedAt: Date.now() }]);
  expect(bodyColor(mark) === "#ffcd3c" && mark.querySelector(".center-jelly-tick") !== null, "水母等待确认时变黄、冒感叹线");
  mark = await markIn([{ phase: "failed", updatedAt: Date.now() }]);
  expect(bodyColor(mark) === "#f2554c" && mark.querySelector(".center-jelly-anger") !== null, "水母失败时变红、冒怒气符号");
  mark = await markIn([{ phase: "completed", updatedAt: Date.now() }]);
  expect(mark.dataset.mood === "done" && bodyColor(mark) === "#5ed69e" && mark.querySelectorAll(".center-jelly-spark").length === 2, "水母刚完成时变绿、冒星星");
  expect(!fixture.querySelector(".cp-light"), "状态灯样式是圆点时不给状态灯槽位");
  await slotWith({ pattern: "mark", pet: "", size: 18 });
  const smaller = jelly(".cp-slot .island__center-slot");
  expect(smaller !== undefined && Math.abs(smaller.height - 18) < 0.6, `大小设成 18 时水母 18px 高（${smaller?.height.toFixed(1)}px）`);

  await syncSwitch(false, { pattern: "cat", pet: "" });
  await render(<Slot key="light" markLight agents={[{ phase: "waiting", updatedAt: Date.now() }]} />);
  const lightJelly = jelly(".cp-light");
  expect(fixture.querySelector<HTMLElement>(".cp-light .center-jelly")?.dataset.mood === "waiting" && lightJelly !== undefined && Math.abs(lightJelly.height - 24) < 0.6,
    "水母状态灯：中心图案关着也跟随 Agent，24px 高");
  expect(!fixture.querySelector(".cp-light .center-pattern") && lightJelly !== undefined && Math.abs(lightJelly.width - (24 * 58) / 43) < 0.6,
    "水母状态灯不套中心图案的外壳，宽度按高度算（不会被撑成 SVG 默认的 300px）");
  await syncSwitch(true, { pattern: "mark", pet: "" });
  await render(<Slot key="light-and-center" markLight />);
  expect(fixture.querySelector(".cp-slot .island__center-slot .center-jelly") !== null && !fixture.querySelector(".cp-agent-icon"),
    "状态灯已是水母时，标题前不再放第二只");
  const runners = defineSlot<object>("island.runner/v1");
  runners.registry.setDisabledOwners(["center-pattern"]);
  const runnerIds = runners.items().map((item) => item.id);
  runners.registry.setDisabledOwners([]);
  expect(runnerIds.includes("status-light.runner") && !runnerIds.includes("center-pattern.runner"),
    "中心图案插件关着时，水母状态灯的 runner 还在（不归中心图案插件）");

  configCalls.length = 0;
  await syncSwitch(true, {});
  await render(<I18nProvider><CenterPatternSettingsGroup /></I18nProvider>);
  await waitFor(() => !fixture.querySelector<HTMLButtonElement>(".select-control__trigger[disabled]"), "宠物下拉列表加载完成");
  const triggers = fixture.querySelectorAll<HTMLButtonElement>(".select-control__trigger");
  const cards = [...fixture.querySelectorAll<HTMLButtonElement>(".settings-cards__card")];
  expect(triggers.length === 1 && fixture.querySelectorAll(".settings-row").length === 4, "岛屿布局里中心图案那一行展开后是开关、图案、宠物、大小四行");
  expect(cards.length === 6 && cards[0].getAttribute("aria-pressed") === "true" && cards.slice(0, 5).every((card) => card.querySelector(".center-pattern-art .center-pattern svg")) && cards[5].querySelector(".center-pattern-art svg"),
    "图案是六张缩略图卡片，前五张画出真实的图案，默认选中眼睛，宠物那张画爪印");
  await act(async () => { cards[5].click(); });
  await act(async () => { triggers[0].click(); });
  await act(async () => { fixture.querySelector<HTMLElement>(".select-control__option[data-value='synthetic']")!.click(); });
  const sizeInput = fixture.querySelector<HTMLInputElement>("input[type='number']")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(sizeInput, "20");
    sizeInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    sizeInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(
    configCalls.length === 3
      && configCalls[0].id === OWNER && configCalls[0].key === "pattern" && configCalls[0].value === "pet"
      && configCalls[1].key === "pet" && configCalls[1].value === "synthetic"
      && configCalls[2].key === "size" && configCalls[2].value === 20,
    "岛屿布局里的中心图案样式把图案、宠物和大小写进内置插件 center-pattern 的配置",
  );

  await render(<Gallery paused={false} />);
  for (const pattern of CENTER_PATTERNS) {
    const box = fixture.querySelector(`[data-cell="${pattern}"] svg`)!.getBoundingClientRect();
    expect(Math.round(box.height) === 22 && box.width > 10 && box.width <= 60, `${pattern} 高 22px、宽不超过 60px（${box.width.toFixed(1)}px）`);
  }
  const eyesBox = fixture.querySelector('[data-cell="eyes"] svg')!.getBoundingClientRect();
  const whites = Array.from(fixture.querySelectorAll('[data-cell="eyes"] .center-eyes-white')).map((white) => white.getBoundingClientRect());
  const eyesMid = (Math.min(...whites.map((box) => box.left)) + Math.max(...whites.map((box) => box.right))) / 2;
  expect(Math.abs(eyesMid - (eyesBox.left + eyesBox.width / 2)) < 0.5, `两只眼睛的中点就是图案的中心（差 ${(eyesMid - eyesBox.left - eyesBox.width / 2).toFixed(2)}px）`);
  const bird = fixture.querySelector(".center-bird-body")!;
  expect(getComputedStyle(bird).animationName === (reducedMotion ? "none" : "center-bird-peck"), reducedMotion ? "减弱动态时小鸟不动" : "小鸟在播放啄食动画");

  const sprite = fixture.querySelector<HTMLElement>(".pet-sprite")!;
  await waitFor(() => sprite.dataset.ready !== undefined, "宠物图集加载后才显示");
  await waitFor(() => getComputedStyle(sprite).opacity === "1", "宠物加载后完全不透明");
  pass("合成图集（8×9）加载后显示");
  const rowOf = (element: Element) => new DOMMatrix(getComputedStyle(element.querySelector(".pet-sprite-row")!).transform).m42;
  const sprites = Array.from(fixture.querySelectorAll<HTMLElement>(".pet-sprite")).slice(0, 5);
  const expectedRows = [0, 7, 6, 5, 3];
  sprites.forEach((element, index) => {
    const sheetHeight = element.querySelector("img")!.getBoundingClientRect().height;
    expect(Math.abs(rowOf(element) + (expectedRows[index] / 9) * sheetHeight) < 0.5, `${MOODS[index]} 显示第 ${expectedRows[index]} 行`);
  });
  const sheetStyle = getComputedStyle(sprites[1].querySelector("img")!);
  expect(reducedMotion ? sheetStyle.animationName === "none" : /steps\(6/.test(sheetStyle.animationTimingFunction), reducedMotion ? "减弱动态时停在第一帧" : "running 按 6 帧 steps() 播放");
  const frame = sprites[0].getBoundingClientRect();
  expect(Math.round(frame.height) === 22 && Math.abs(frame.width - (22 * 192) / 208) < 0.5, "一帧按 192:208 缩放到 22px 高");

  await render(<PetSprite src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" mood="idle" />);
  const invalidSheet = fixture.querySelector<HTMLImageElement>(".pet-sprite img")!;
  await waitFor(() => invalidSheet.complete, "无效图片加载完成");
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  expect(fixture.querySelector<HTMLElement>(".pet-sprite")!.dataset.ready === undefined, "不是 8×9 / 8×11 网格的图片不显示");

  trackingCalls.length = 0;
  await render(<CenterPattern pattern="eyes" />);
  const pupil = fixture.querySelector<SVGGElement>(".center-eyes-pupil")!;
  if (reducedMotion) {
    expect(pupil.style.transform === "" && trackingCalls.length === 0, "减弱动态时眼睛不跟随、不请求光标事件");
  } else {
    expect(trackingCalls[trackingCalls.length - 1] === true, "显示眼睛时请求原生光标事件");
    const eye = fixture.querySelector(".center-eyes-white")!.getBoundingClientRect();
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: eye.right + 400, clientY: eye.top + eye.height / 2 }));
    expect(/translate\(2\.6px, 0px\)/.test(pupil.style.transform), `窗口内鼠标在右边时瞳孔看向右边（${pupil.style.transform}）`);
    await act(async () => { await emit(ISLAND_CURSOR_MOVED_EVENT, { x: eye.left - 400, y: eye.bottom + 400 }); });
    expect(/translate\(-1\.\d+px, 1\.\d+px\)/.test(pupil.style.transform), `窗口外光标在左下时瞳孔看向左下（${pupil.style.transform}）`);
    await render(<CenterPattern pattern="eyes" paused />);
    expect(trackingCalls[trackingCalls.length - 1] === false, "暂停后关闭原生光标事件");

    trackingCalls.length = 0;
    await render(<><CenterPattern pattern="eyes" /><CenterPattern pattern="eyes" /></>);
    expect(trackingCalls[trackingCalls.length - 1] === true, "两双眼睛时原生光标事件开启");
    const callsWithTwo = trackingCalls.length;
    await render(<CenterPattern pattern="eyes" />);
    expect(trackingCalls.length === callsWithTwo, "去掉一双后不关闭原生光标事件");
    await render(<CenterPattern pattern="cat" />);
    expect(trackingCalls[trackingCalls.length - 1] === false, "最后一双去掉后才关闭");

    mockWindows("settings");
    trackingCalls.length = 0;
    await render(<CenterPattern pattern="eyes" />);
    const previewPupil = fixture.querySelector<SVGGElement>(".center-eyes-pupil")!;
    window.dispatchEvent(new MouseEvent("mousemove", { clientX: 0, clientY: 0 }));
    expect(trackingCalls.length === 0 && previewPupil.style.transform !== "", "设置窗口里的眼睛不请求原生光标事件，只跟随窗口内鼠标");
    mockWindows("main");
  }
  await render(<CenterPattern pattern="cat" paused />);
  const cat = fixture.querySelector(".center-cat-eye")!;
  expect(reducedMotion || getComputedStyle(cat).animationPlayState === "paused", "暂停时动画停住");

  results.textContent = `${messages.join("\n")}\n\n全部 ${messages.length} 项检查通过。`;
  results.dataset.result = "passed";
}

if (params.has("test")) {
  runChecks().catch((error: unknown) => {
    results.textContent = `${messages.join("\n")}\nFAIL ${String(error)}`;
    results.dataset.result = "failed";
  });
} else {
  if (params.has("slot")) {
    centerPlugin.config = { pattern: params.get("slot") || "eyes", pet: params.get("pet") ?? "synthetic" };
    void render(<Slot agents={params.has("waiting") ? [{ phase: "waiting", updatedAt: Date.now() }] : []} />);
  } else void render(<Gallery paused={params.has("paused")} mood={(params.get("mood") as PetMood) || undefined} />);
  results.textContent = `prefers-reduced-motion: ${reducedMotion ? "reduce" : "no-preference"}。?paused 暂停，?mood=running 只看一个状态，?slot=pet&pet=<id> 看折叠栏槽位。`;
}
