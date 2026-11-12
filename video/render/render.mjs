import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOUND_FILES = path.resolve(root, "..", "src", "assets", "sounds", "thumb-piano");
const SYNTH = {
  click: { source: "sine=frequency=1500:duration=0.04", fx: "afade=t=out:st=0:d=0.04,volume=0.22" },
  whoosh: { source: "anoisesrc=color=pink:duration=0.9:amplitude=0.7", fx: "bandpass=f=650:width_type=o:w=2,afade=t=in:d=0.4,afade=t=out:st=0.45:d=0.45,volume=0.55" },
};

function findShell(dir = path.join(root, ".browser")) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findShell(full);
      if (found) return found;
    } else if (/^chrome-headless-shell(\.exe)?$/.test(entry.name)) return full;
  }
  return null;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function addSound(ffmpeg, silent, file, cues, durationMs) {
  if (cues.length === 0) {
    renameSync(silent, file);
    return;
  }
  const inputs = ["-i", silent];
  const chains = cues.map((cue, index) => {
    const synth = SYNTH[cue.name];
    if (synth) inputs.push("-f", "lavfi", "-i", synth.source);
    else inputs.push("-i", path.join(SOUND_FILES, `${cue.name}.wav`));
    return `[${index + 1}:a]aresample=48000,${synth ? synth.fx : "volume=1.6"},adelay=${cue.at}:all=1[a${index}]`;
  });
  const mix = `${cues.map((_, index) => `[a${index}]`).join("")}amix=inputs=${cues.length}:normalize=0:duration=longest,apad,atrim=0:${(durationMs / 1000).toFixed(3)},aformat=channel_layouts=stereo[a]`;
  await run(ffmpeg, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${chains.join(";")};${mix}`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", file]);
  rmSync(silent);
}
const START_TIME = Date.UTC(2026, 10, 18, 2, 24, 0) / 1000;
const TICK_BASE = 100_000_000;

function options(argv) {
  const result = { v: "001-one-island", lang: "zh", fps: 60, scale: 1.5, still: null, from: 0, to: null, out: null, ffmpeg: "ffmpeg" };
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index].replace(/^--/, "");
    if (!(key in result)) throw new Error(`unknown option ${argv[index]}`);
    result[key] = argv[++index];
  }
  return { ...result, fps: Number(result.fps), scale: Number(result.scale), from: Number(result.from), to: result.to === null ? null : Number(result.to) };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startVite() {
  const port = await freePort();
  const vite = path.resolve(root, "..", "node_modules", "vite", "bin", "vite.js");
  const child = spawn(process.execPath, [vite, "--config", path.join(root, "vite.config.ts"), "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/index.html`)).ok) return { url, stop: () => child.kill() };
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  child.kill();
  throw new Error("vite did not start");
}

async function openStage(browser, url) {
  const session = await browser.target().createCDPSession();
  const { targetId } = await session.send("Target.createTarget", { url: "about:blank", width: 1280, height: 720, enableBeginFrameControl: true });
  const target = await browser.waitForTarget((candidate) => candidate._targetId === targetId);
  const page = await target.page();
  const cdp = await page.createCDPSession();
  const problems = [];
  page.on("console", (message) => { if (message.type() === "error") problems.push(message.text().slice(0, 400)); });
  page.on("pageerror", (error) => problems.push(String(error).slice(0, 400)));
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 0, mobile: false });
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause", initialVirtualTime: START_TIME });
  const advance = (ms) => new Promise((resolve) => {
    cdp.once("Emulation.virtualTimeBudgetExpired", resolve);
    void cdp.send("Emulation.setVirtualTimePolicy", { policy: "pauseIfNetworkFetchesPending", budget: ms });
  });
  let ticks = TICK_BASE;
  const frame = async (interval, shot) => {
    ticks += interval;
    const result = await cdp.send("HeadlessExperimental.beginFrame", { frameTimeTicks: ticks, interval, noDisplayUpdates: !shot, screenshot: shot ? { format: "png", optimizeForSpeed: true } : undefined });
    return result.screenshotData ? Buffer.from(result.screenshotData, "base64") : null;
  };
  const navigation = page.goto(url, { waitUntil: "load", timeout: 120_000 });
  let loaded = false;
  void navigation.then(() => { loaded = true; });
  while (!loaded) {
    await advance(50);
    await frame(50, false);
  }
  await navigation;
  return { page, advance, frame, problems };
}

async function waitReady(stage) {
  for (let attempt = 0; attempt < 600; attempt++) {
    await stage.advance(50);
    await stage.frame(50, false);
    const state = await stage.page.evaluate(() => {
      const video = globalThis.__video;
      if (!video) return "loading";
      if (!video.__readyFlag) {
        video.__readyFlag = "waiting";
        void video.ready.then(() => { video.__readyFlag = "ready"; });
      }
      return video.__readyFlag;
    });
    if (attempt % 20 === 0) debug(`ready? ${state} ${stage.problems.join(" | ")}`);
    if (state === "ready") return;
  }
  throw new Error(`the stage did not become ready: ${stage.problems.join(" | ")}`);
}

const settle = async (page) => {
  await page.evaluate(() => 0);
  await page.evaluate(() => 0);
};
const debug = (text) => { if (process.env.RENDER_DEBUG) console.log(text); };

function encoder(file, fps, ffmpeg) {
  const child = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-vf", "scale=out_color_matrix=bt709", "-colorspace", "bt709", file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)));
  });
  const write = (buffer) => new Promise((resolve, reject) => child.stdin.write(buffer, (error) => error ? reject(error) : resolve()));
  return { write, finish: () => { child.stdin.end(); return done; } };
}

async function main() {
  const opts = options(process.argv.slice(2));
  const shell = findShell();
  if (!shell) throw new Error("chrome-headless-shell is missing; run `pnpm browser` in video/");
  const outDir = path.join(root, "out", opts.v);
  mkdirSync(outDir, { recursive: true });
  const vite = await startVite();
  const browser = await puppeteer.launch({
    executablePath: shell, headless: "shell",
    args: ["--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging", "--deterministic-mode", `--force-device-scale-factor=${opts.scale}`, "--window-size=1280,720", "--hide-scrollbars", "--font-render-hinting=none", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const stage = await openStage(browser, `${vite.url}/index.html?capture=1&v=${opts.v}&lang=${opts.lang}`);
    await waitReady(stage);
    const durationMs = await stage.page.evaluate(() => globalThis.__video.durationMs);
    const interval = 1000 / opts.fps;
    const stills = opts.still ? String(opts.still).split(",").map(Number) : null;
    const lastMs = stills ? Math.max(...stills) * 1000 : Math.min(durationMs, opts.to === null ? durationMs : opts.to * 1000);
    const total = Math.round(lastMs / interval);
    const first = stills ? 0 : Math.round((opts.from * 1000) / interval);
    const stillFrames = new Map((stills ?? []).map((seconds) => [Math.max(1, Math.round((seconds * 1000) / interval)), seconds]));
    const file = opts.out ?? path.join(outDir, `${opts.v}-${opts.lang}.mp4`);
    const silent = file.replace(/\.mp4$/, ".silent.mp4");
    const video = stills ? null : encoder(silent, opts.fps, opts.ffmpeg);
    await stage.page.evaluate(() => globalThis.__video.play());
    const started = Date.now();
    for (let index = 1; index <= total; index++) {
      await stage.advance(interval);
      const wanted = stills ? stillFrames.has(index) : index > first;
      if (wanted) await settle(stage.page);
      const shot = await stage.frame(interval, wanted);
      if (shot && stills) {
        const name = path.join(outDir, `still-${opts.lang}-${stillFrames.get(index).toFixed(2).padStart(6, "0")}.png`);
        writeFileSync(name, shot);
        console.log(name);
      } else if (shot) {
        await video.write(shot);
      }
      if (!stills && index % (opts.fps * 5) === 0) console.log(`${(index / opts.fps).toFixed(0)}s / ${(total / opts.fps).toFixed(0)}s  (${((Date.now() - started) / 1000).toFixed(0)}s elapsed)`);
    }
    if (video) {
      await video.finish();
      const cues = first === 0 ? await stage.page.evaluate(() => [...globalThis.__video.sounds()]) : [];
      await addSound(opts.ffmpeg, silent, file, cues, total * interval);
      console.log(`${file}  (${cues.length} sound cues)`);
    }
    if (stage.problems.length) console.log(`page errors:\n${[...new Set(stage.problems)].join("\n")}`);
  } finally {
    await browser.close();
    vite.stop();
  }
}

await main();
