import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
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

function run(command, args, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    let timedOut = false;
    const timer = timeoutMs > 0 ? setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs) : null;
    child.on("error", reject);
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (timedOut) reject(new Error(`${command} timed out`));
      else if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

async function runWithRetry(command, args, timeoutMs, attempts) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run(command, args, timeoutMs);
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.log(`${error.message}; retrying (${attempt}/${attempts - 1})`);
    }
  }
}

const STEREO = "aformat=sample_rates=48000:channel_layouts=stereo";

async function addSound(ffmpeg, silent, file, cues, durationMs, voiceDir, bgm) {
  if (cues.length === 0 && !bgm) {
    renameSync(silent, file);
    return;
  }
  const seconds = durationMs / 1000;
  const inputs = ["-i", silent];
  const voices = [];
  const others = [];
  const chains = cues.map((cue, index) => {
    const synth = SYNTH[cue.name];
    const voice = cue.name.startsWith("voice:");
    if (synth) inputs.push("-f", "lavfi", "-i", synth.source);
    else if (voice) inputs.push("-i", path.join(voiceDir, `${cue.name.slice(6)}.mp3`));
    else inputs.push("-i", path.join(SOUND_FILES, `${cue.name}.wav`));
    (voice ? voices : others).push(`[a${index}]`);
    return `[${index + 1}:a]${STEREO},${synth ? synth.fx : voice ? "volume=1.0" : "volume=1.6"},adelay=${cue.at}:all=1[a${index}]`;
  });
  const finals = [...others];
  if (voices.length > 0) {
    chains.push(`${voices.join("")}amix=inputs=${voices.length}:normalize=0:duration=longest,apad=whole_dur=${seconds.toFixed(3)},asplit=2[voice][key]`);
    finals.push("[voice]");
  }
  if (bgm) {
    inputs.push("-stream_loop", "3", "-i", bgm);
    const bed = `[${cues.length + 1}:a]${STEREO},atrim=0:${seconds.toFixed(3)},volume=0.8,afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, seconds - 2).toFixed(3)}:d=2`;
    chains.push(voices.length > 0 ? `${bed}[bed];[bed][key]sidechaincompress=threshold=0.05:ratio=2.5:attack=80:release=900[bgm]` : `${bed}[bgm]`);
    finals.push("[bgm]");
  } else if (voices.length > 0) {
    chains.push("[key]anullsink");
  }
  const mix = `${finals.join("")}amix=inputs=${finals.length}:normalize=0:duration=longest,apad=whole_dur=${seconds.toFixed(3)},atrim=0:${seconds.toFixed(3)},${STEREO}[a]`;
  await runWithRetry(ffmpeg, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", `${chains.join(";")};${mix}`, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", seconds.toFixed(3), "-movflags", "+faststart", file], 90_000, 4);
  rmSync(silent);
}
function startTime(video) {
  const file = path.join(root, "src", "videos", video, "render.json");
  const clock = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")).clock : null;
  const [hour, minute, second] = (clock ?? "10:24:00").split(":").map(Number);
  return Date.UTC(2026, 10, 18, hour - 8, minute, second) / 1000;
}
const TICK_BASE = 100_000_000;

function options(argv) {
  const result = { v: "001-one-island", lang: "zh", format: "wide", fps: 60, scale: 1.5, still: null, from: 0, to: null, out: null, ffmpeg: "ffmpeg" };
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

async function openStage(browser, url, size, virtualStart) {
  const session = await browser.target().createCDPSession();
  const { targetId } = await session.send("Target.createTarget", { url: "about:blank", ...size, enableBeginFrameControl: true });
  const target = await browser.waitForTarget((candidate) => candidate._targetId === targetId);
  const page = await target.page();
  const cdp = await page.createCDPSession();
  const problems = [];
  page.on("console", (message) => { if (message.type() === "error") problems.push(message.text().slice(0, 400)); });
  page.on("pageerror", (error) => problems.push(String(error).slice(0, 400)));
  await cdp.send("Emulation.setDeviceMetricsOverride", { ...size, deviceScaleFactor: 0, mobile: false });
  await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause", initialVirtualTime: virtualStart });
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
  await page.evaluate(() => {
    const docs = [document, ...[...document.querySelectorAll("iframe")].map((frame) => frame.contentDocument).filter(Boolean)];
    for (const doc of docs) {
      for (const animation of doc.getAnimations()) if (animation.playState === "running") animation.currentTime = animation.currentTime;
      void doc.body?.offsetHeight;
    }
  });
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
  const size = opts.format === "vertical" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
  const tag = opts.format === "vertical" ? `${opts.lang}-vertical` : opts.lang;
  const outDir = path.join(root, "out", opts.v);
  mkdirSync(outDir, { recursive: true });
  const vite = await startVite();
  const browser = await puppeteer.launch({
    executablePath: shell, headless: "shell",
    args: ["--enable-begin-frame-control", "--run-all-compositor-stages-before-draw", "--disable-threaded-animation", "--disable-threaded-scrolling", "--disable-checker-imaging", "--deterministic-mode", `--force-device-scale-factor=${opts.scale}`, `--window-size=${size.width},${size.height}`, "--hide-scrollbars", "--font-render-hinting=none", "--autoplay-policy=no-user-gesture-required"],
  });
  try {
    const stage = await openStage(browser, `${vite.url}/index.html?capture=1&v=${opts.v}&lang=${opts.lang}&format=${opts.format}`, size, startTime(opts.v));
    await waitReady(stage);
    const durationMs = await stage.page.evaluate(() => globalThis.__video.durationMs);
    const interval = 1000 / opts.fps;
    const stills = opts.still ? String(opts.still).split(",").map(Number) : null;
    const lastMs = stills ? Math.max(...stills) * 1000 : Math.min(durationMs, opts.to === null ? durationMs : opts.to * 1000);
    const total = Math.round(lastMs / interval);
    const first = stills ? 0 : Math.round((opts.from * 1000) / interval);
    const stillFrames = new Map((stills ?? []).map((seconds) => [Math.max(1, Math.round((seconds * 1000) / interval)), seconds]));
    const file = opts.out ?? path.join(outDir, `${opts.v}-${tag}.mp4`);
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
        const name = path.join(outDir, `still-${tag}-${stillFrames.get(index).toFixed(2).padStart(6, "0")}.png`);
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
      const bgmName = await stage.page.evaluate(() => globalThis.__video.bgm);
      const bgmFile = bgmName && first === 0 ? path.join(root, "assets", "bgm", bgmName) : null;
      const bgm = bgmFile && existsSync(bgmFile) ? bgmFile : null;
      if (bgmFile && !bgm) console.log(`no background music: ${bgmFile} is missing`);
      await addSound(opts.ffmpeg, silent, file, cues, total * interval, path.join(root, "assets", "voice", opts.v, opts.lang), bgm);
      console.log(`${file}  (${cues.length} sound cues)`);
    }
    if (stage.problems.length) console.log(`page errors:\n${[...new Set(stage.problems)].join("\n")}`);
  } finally {
    await browser.close();
    vite.stop();
  }
}

await main();
