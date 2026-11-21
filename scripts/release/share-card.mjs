import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { latestNotesVersion, parseReleaseNotes } from "./share-card-notes.mjs";
import { BOT_INBOX_ENV, pushToBot } from "./share-push.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NOTES_DIR = join(ROOT, "docs/releases");
const TEMPLATE = join(ROOT, "scripts/release/share-card.html");
const ICON = join(ROOT, "docs/assets/logo/app-icon.svg");
const OUT_ROOT = join(ROOT, "src-tauri/target/release-share");
const WIDTH = 1080;
const BROWSERS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];
const LABELS = {
  zh: { updated: "浮屿已更新", notes: "更新说明", update: "在 设置 → 关于 里更新", fixes: "修复", section: "更新内容" },
  en: { updated: "Fuyu updated", notes: "Release notes", update: "Update from Settings → About", fixes: "Fixes", section: "What's new" },
};

function usage() {
  return [
    "Usage: pnpm release:share [<version>] [--lang zh|en] [--scale <n>] [--out <dir>] [--no-copy] [--no-open] [--push]",
    "  <version>   0.3.12-beta.2 or v0.3.12-beta.2; defaults to the newest docs/releases/v*.md",
    "  --lang      only one language (default: both)",
    "  --scale     pixel ratio of the PNG (default 2, i.e. 2160px wide)",
    "  --out       output folder (default src-tauri/target/release-share/v<version>)",
    "  --no-copy   do not copy the image to the clipboard (only the Chinese image is copied)",
    "  --no-open   do not open the folder afterwards",
    `  --push      upload the Chinese image to the QQ bot inbox in ${BOT_INBOX_ENV} (bot/astrbot/astrbot_plugin_fuyu_release)`,
  ].join("\n");
}

export function parseArgs(argv) {
  const options = { version: null, langs: ["zh", "en"], scale: 2, out: null, open: true, copy: true, push: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (next === undefined) throw new Error(`${arg} needs a value.\n${usage()}`);
      return next;
    };
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--lang") options.langs = [value()];
    else if (arg === "--scale") options.scale = Number(value());
    else if (arg === "--out") options.out = value();
    else if (arg === "--no-open") options.open = false;
    else if (arg === "--no-copy") options.copy = false;
    else if (arg === "--push") options.push = true;
    else if (!arg.startsWith("-") && !options.version) options.version = arg.replace(/^v/, "");
    else throw new Error(`Unknown argument ${arg}.\n${usage()}`);
  }
  if (options.langs.some((lang) => !LABELS[lang])) throw new Error("--lang must be zh or en.");
  if (!(options.scale >= 1 && options.scale <= 4)) throw new Error("--scale must be between 1 and 4.");
  return options;
}

function findBrowser() {
  const browser = process.env.CHROME_PATH ?? BROWSERS.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error("No Chrome or Edge found; set CHROME_PATH.");
  return browser;
}

function releaseDate(version) {
  const tagged = spawnSync("git", ["log", "-1", "--format=%cs", `v${version}`, "--"], { cwd: ROOT, encoding: "utf8" });
  const date = tagged.status === 0 ? tagged.stdout.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, "0")).join("-");
}

function run(browser, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(browser, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => child.kill(), 60_000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`Browser exited with ${code}.\n${stderr.slice(-2000)}`));
    });
  });
}

async function render(browser, htmlPath, pngPath, scale, profile) {
  const common = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "--virtual-time-budget=3000"];
  const url = pathToFileURL(htmlPath).href;
  const dom = await run(browser, [...common, `--window-size=${WIDTH},2000`, "--dump-dom", url]);
  const height = Number(dom.match(/data-height="(\d+)"/)?.[1]);
  if (!height) throw new Error(`Could not measure the card in ${htmlPath}.`);
  rmSync(pngPath, { force: true });
  try {
    await run(browser, [...common, `--window-size=${WIDTH},${height}`, `--force-device-scale-factor=${scale}`, `--screenshot=${pngPath}`, url]);
  } catch (error) {
    if (!existsSync(pngPath) || statSync(pngPath).size === 0) throw error;
  }
  if (!existsSync(pngPath)) throw new Error(`The browser did not write ${pngPath}.`);
  return height;
}

function copyImage(pngPath) {
  const run = (command, args, input) => spawnSync(command, args, { input, encoding: "utf8", stdio: ["pipe", "ignore", "pipe"] });
  let result;
  if (process.platform === "darwin") {
    result = run("osascript", ["-e", `set the clipboard to (read (POSIX file ${JSON.stringify(pngPath)}) as «class PNGf»)`]);
  } else if (process.platform === "win32") {
    const literal = pngPath.replace(/'/g, "''");
    result = run("powershell", ["-NoProfile", "-STA", "-Command", `Add-Type -AssemblyName System.Windows.Forms, System.Drawing; $image = [System.Drawing.Image]::FromFile('${literal}'); [System.Windows.Forms.Clipboard]::SetImage($image); $image.Dispose()`]);
  } else {
    result = run("xclip", ["-selection", "clipboard", "-t", "image/png", "-i", pngPath]);
  }
  if (result.error || result.status !== 0) {
    console.warn(`Could not copy the image to the clipboard: ${result.error?.message ?? result.stderr.trim()}`);
    return false;
  }
  return true;
}

function openFolder(folder) {
  const [command, args] = process.platform === "win32" ? ["explorer", [folder]] : process.platform === "darwin" ? ["open", [folder]] : ["xdg-open", [folder]];
  spawn(command, args, { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const version = options.version ?? latestNotesVersion(readdirSync(NOTES_DIR));
  if (!version) throw new Error("No release notes found in docs/releases.");
  const notesPath = join(NOTES_DIR, `v${version}.md`);
  if (!existsSync(notesPath)) throw new Error(`No release notes at docs/releases/v${version}.md.`);
  const markdown = readFileSync(notesPath, "utf8");
  if (markdown.includes("<!-- release-notes-draft -->")) console.warn(`v${version} is still a draft; the image shows it as it is now.`);
  const notes = parseReleaseNotes(markdown);
  const date = releaseDate(version);
  const icon = readFileSync(ICON, "utf8").replace(/<\?xml[^>]*>\s*/, "").replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height)="\d+"/g, ""));
  const template = readFileSync(TEMPLATE, "utf8");
  const outDir = resolve(options.out ?? join(OUT_ROOT, `v${version}`));
  mkdirSync(outDir, { recursive: true });
  const browser = findBrowser();
  let chinese = null;
  const work = mkdtempSync(join(tmpdir(), "fuyu-share-"));
  try {
    for (const lang of options.langs) {
      const sections = notes[lang];
      if (!sections.length) {
        console.warn(`v${version} has no ${lang === "zh" ? "更新内容" : "What's New"} items; skipped ${lang}.`);
        continue;
      }
      const data = { version, date, labels: LABELS[lang], sections };
      const html = template
        .replace("__DATA__", () => JSON.stringify(data).replace(/</g, "\\u003c"))
        .replace("__ICON__", () => JSON.stringify(icon).replace(/</g, "\\u003c"));
      const htmlPath = join(work, `card-${lang}.html`);
      writeFileSync(htmlPath, html);
      const pngPath = join(outDir, `fuyu-v${version}-${lang}.png`);
      const height = await render(browser, htmlPath, pngPath, options.scale, join(work, `profile-${lang}`));
      if (lang === "zh") chinese = pngPath;
      console.log(`${pngPath}  (${WIDTH * options.scale}×${height * options.scale})`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (options.copy && chinese && copyImage(chinese)) console.log(`Copied to the clipboard: ${chinese}`);
  if (options.open) openFolder(outDir);
  if (options.push) {
    if (!chinese) throw new Error("No Chinese image to push.");
    pushToBot(chinese, version);
    console.log(`Uploaded to the QQ bot inbox: ${chinese}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
