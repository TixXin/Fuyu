import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const pagesDir = path.join(root, "tests", "regression");
const official = path.join(root, "plugins", "v3", "official");
const DATA_FILE = "shot-data.json";
const DAY = "2026-11-19";
const WRITTEN_AT = `${DAY}T18:02:00`;
const SHOT_AT = `${DAY}T18:30:00`;

const SHOTS = [
  { plugin: "ecdict", file: "lookup.png", page: "shot-ecdict.html", query: { word: "float" }, width: 800, height: 400 },
  { plugin: "ecdict", file: "inflection.png", page: "shot-ecdict.html", query: { word: "wrote" }, width: 520, height: 640 },
  { plugin: "ecdict", file: "reverse.png", page: "shot-ecdict.html", query: { word: "岛屿" }, width: 520, height: 640 },
  { plugin: "todo-digest", file: "preview.png", page: "shot-todo-digest-settings.html", query: { view: "preview" }, width: 800, height: 900 },
  { plugin: "todo-digest", file: "settings.png", page: "shot-todo-digest-settings.html", query: { view: "dialog" }, width: 800, height: 900 },
  { plugin: "todo-digest", file: "notice.png", page: "shot-todo-digest-notice.html", query: {}, width: 900, height: 360 },
];

const TODOS = [
  { title: "写周报，周五前发到组里", completed: false },
  { title: "修好贴边收起后提示不弹的问题", project: "浮屿", completed: false },
  { title: "给插件市场补截图", project: "浮屿", completed: false },
  { title: "预约周六上午的牙医", completed: false },
  { title: "给妈妈回个电话", completed: false },
  { title: "续费域名", completed: true },
  { title: "取快递", completed: true },
];
const NOTE = "上午和设计对了一遍设置页，下午把评审意见改完了。";

const load = (file) => import(pathToFileURL(path.join(root, file)).href);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function ecdictData(words) {
  const host = await load("plugins/v3/official/ecdict/src/host.ts");
  let spec = null;
  host.apply({
    translatorEngines: {
      register(next) {
        spec = next;
        return () => {};
      },
    },
  });
  if (!spec) throw new Error("the ecdict host registered no translation engine");
  const lookups = {};
  for (const word of words) lookups[word] = (await spec.translate({ text: word, direction: "auto", model: spec.defaultModel })).text;
  return { engine: spec.engine, label: spec.label, defaultModel: spec.defaultModel, hasSecret: spec.hasSecret === true, lookups };
}

async function withClock(at, run) {
  const RealDate = Date;
  const fixed = new RealDate(at).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixed);
      else super(...args);
    }
    static now() {
      return fixed;
    }
  };
  try {
    return await run();
  } finally {
    globalThis.Date = RealDate;
  }
}

async function todoDigestData() {
  Object.defineProperty(globalThis.navigator, "language", { configurable: true, get: () => "zh-CN" });
  const dataDir = mkdtempSync(path.join(tmpdir(), "fuyu-shot-todo-digest-"));
  try {
    return await withClock(WRITTEN_AT, async () => {
      const host = await load("plugins/v3/official/todo-digest/src/host.ts");
      const createdAt = new Date(`${DAY}T09:10:00`).getTime();
      const day = { date: DAY, todos: TODOS.map((todo, index) => ({ id: `todo-${index + 1}`, createdAt: createdAt + index * 60_000, ...todo })), scheduled: [], activeTodoId: null };
      let note = NOTE;
      const todos = {
        list: async () => day,
        note: async () => ({ date: DAY, note }),
        setNote: async (params) => {
          note = params.note;
          return { date: DAY, note };
        },
        on: () => () => {},
      };
      const notices = [];
      const messages = {
        notify: async (params) => {
          notices.push(params);
          return { shown: true };
        },
      };
      const handlers = new Map();
      host.apply({
        dataDir,
        services: { get: (definition) => (definition.name === "todos/v1" ? todos : messages) },
        clients: { handle: (method, handler) => handlers.set(method, handler), publish: () => {} },
        commands: { register: () => {} },
        setTimeout: () => () => {},
        setInterval: () => () => {},
      });
      await handlers.get("state")();
      const state = await handlers.get("writeDigest")();
      if (notices.length !== 1) throw new Error(`the todo-digest host sent ${notices.length} notices, expected 1`);
      return { state, notice: notices[0], note };
    });
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const filters = [];
  let out = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--out") out = path.resolve(argv[(index += 1)]);
    else filters.push(argv[index]);
  }
  return { filters, out };
}

function placePages() {
  const placed = [];
  for (const name of readdirSync(here).filter((file) => /^shot-.+\.(html|tsx)$/.test(file))) {
    const target = path.join(pagesDir, name);
    if (existsSync(target)) throw new Error(`${target} already exists; remove it first`);
    copyFileSync(path.join(here, name), target);
    placed.push(target);
  }
  return placed;
}

async function main() {
  if (!existsSync(path.join(official, "ecdict", "package.json"))) throw new Error("run this from the repository root");
  const { filters, out } = parseArgs(process.argv.slice(2));
  const shots = SHOTS.filter((shot) => filters.length === 0 || filters.some((word) => `${shot.plugin}/${shot.file}`.includes(word)));
  if (shots.length === 0) throw new Error(`no shot matches ${filters.join(", ")}`);
  const { withBrowser } = await load("packages/plugin-cli/src/shots/browser.mjs");
  const { createServer } = await load("node_modules/vite/dist/node/index.js");
  const data = {
    now: SHOT_AT,
    ecdict: await ecdictData(SHOTS.filter((shot) => shot.plugin === "ecdict").map((shot) => shot.query.word)),
    todoDigest: await todoDigestData(),
  };
  const dataPath = path.join(pagesDir, DATA_FILE);
  if (existsSync(dataPath)) throw new Error(`${dataPath} already exists; remove it first`);
  let placed = [];
  let vite = null;
  try {
    placed = placePages();
    writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    placed.push(dataPath);
    const port = await freePort();
    vite = await createServer({ root, logLevel: "silent", server: { port, strictPort: true, host: "127.0.0.1" } });
    await vite.listen();
    for (const shot of shots) {
      const url = `http://127.0.0.1:${port}/tests/regression/${shot.page}?${new URLSearchParams(shot.query)}`;
      const png = await withBrowser(async (page) => {
        await page.open(url);
        const report = JSON.parse(await page.until("window.__shot && window.__shot.state !== 'pending' ? JSON.stringify(window.__shot) : ''", `${shot.page} to render`, 60_000));
        if (report.state !== "ready") throw new Error(`${shot.page}: ${report.error}`);
        await sleep(200);
        return page.capture(report.rect);
      }, { width: shot.width, height: shot.height, scale: 2 });
      const target = out ? path.join(out, `${shot.plugin}-${shot.file}`) : path.join(official, shot.plugin, "screenshots", shot.file);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, png);
      console.log(`${path.relative(root, target) || target}  ${(png.length / 1024).toFixed(0)} KB`);
    }
  } finally {
    await vite?.close();
    for (const file of placed) rmSync(file, { force: true });
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
