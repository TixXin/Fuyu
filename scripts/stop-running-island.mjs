import { execFileSync } from "node:child_process";

const WINDOWS_IMAGES = ["fuyu.exe", "focusd-island.exe", "fly-island.exe"];
const MAC_PATTERNS = ["\\.app/Contents/MacOS/fuyu$"];
const EXIT_TIMEOUT_MS = 5_000;
const POLL_INTERVAL_MS = 100;
const isMac = process.platform === "darwin";

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

const running = runningImages();

if (running.length > 0) {
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
