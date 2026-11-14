import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WINDOWS_IMAGES = ["fuyu.exe", "focusd-island.exe", "fly-island.exe"];
const MAC_PATTERNS = ["\\.app/Contents/MacOS/fuyu$"];
const EXIT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 100;
const isMac = process.platform === "darwin";

export function sideLane(env = process.env) {
  const lane = Number(env.FOCUSD_DEV_LANE);
  return /^\d+$/.test(env.FOCUSD_DEV_LANE ?? "") && lane >= 1 && lane <= 999 ? lane : null;
}

export function debugBuildPids(processes, debugDir, windows = process.platform === "win32") {
  const flavour = windows ? path.win32 : path.posix;
  const fold = (value) => (windows ? value.toLowerCase() : value);
  const wanted = fold(flavour.normalize(debugDir));
  const names = windows ? ["fuyu.exe"] : ["fuyu"];
  return processes
    .filter(({ file }) => file && fold(flavour.dirname(flavour.normalize(file))) === wanted && names.includes(fold(flavour.basename(file))))
    .map(({ pid }) => pid);
}

function listProcesses() {
  try {
    if (process.platform === "win32") {
      const output = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name = 'fuyu.exe'\" | ForEach-Object { \"$($_.ProcessId)|$($_.ExecutablePath)\" }"],
        { encoding: "utf8", windowsHide: true },
      );
      return output.split(/\r?\n/).filter(Boolean).map((line) => {
        const [pid, ...rest] = line.split("|");
        return { pid: Number(pid), file: rest.join("|").trim() };
      });
    }
    const output = execFileSync("ps", ["-axo", "pid=,comm="], { encoding: "utf8" });
    return output.split("\n").filter(Boolean).map((line) => {
      const match = line.trim().match(/^(\d+)\s+(.*)$/);
      return match ? { pid: Number(match[1]), file: match[2] } : { pid: 0, file: "" };
    });
  } catch {
    return [];
  }
}

function stopPid(pid) {
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/F", "/PID", String(pid)], { stdio: "ignore", windowsHide: true });
    else process.kill(pid);
  } catch {
  }
}

async function stopSideBuild(root) {
  const debugDir = path.join(root, "src-tauri", "target", "debug");
  const pids = debugBuildPids(listProcesses(), debugDir);
  if (pids.length === 0) return;
  for (const pid of pids) stopPid(pid);
  const deadline = Date.now() + EXIT_TIMEOUT_MS;
  while (debugBuildPids(listProcesses(), debugDir).length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  console.log(`Stopped the development island (pid ${pids.join(", ")}); other islands keep running.`);
}

function windowsRunning(name) {
  try {
    const output = execFileSync(
      "tasklist",
      ["/FI", `IMAGENAME eq ${name}`, "/FO", "CSV", "/NH"],
      { encoding: "latin1", windowsHide: true },
    );
    return output.toLowerCase().includes(`"${name}"`);
  } catch {
    return false;
  }
}

function macRunning(pattern) {
  try {
    return execFileSync("pgrep", ["-f", pattern], { encoding: "utf8" }).trim() !== "";
  } catch {
    return false;
  }
}

function runningImages() {
  return isMac ? MAC_PATTERNS.filter(macRunning) : WINDOWS_IMAGES.filter(windowsRunning);
}

function stop(name) {
  try {
    if (isMac) execFileSync("pkill", ["-f", name], { stdio: "ignore" });
    else execFileSync("taskkill", ["/F", "/IM", name], { stdio: "ignore", windowsHide: true });
  } catch {
  }
}

async function stopEveryIsland() {
  const running = runningImages();
  if (running.length === 0) return;
  for (const name of running) stop(name);

  const deadline = Date.now() + EXIT_TIMEOUT_MS;
  while (runningImages().length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  const remaining = runningImages();
  if (remaining.length > 0) {
    console.warn(`Could not stop running island instance: ${remaining.join(", ")}`);
  } else {
    console.log(`Stopped running island instance: ${running.join(", ")}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (sideLane() === null) await stopEveryIsland();
  else await stopSideBuild(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
}
