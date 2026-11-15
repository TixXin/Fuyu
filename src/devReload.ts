import type { RootOptions } from "react-dom/client";
import { nextRemountStep, parseRemountAttempts, remountDelay } from "./lib/devRemount";

const MOUNTED = "fuyuMounted";
const ATTEMPTS = "fuyuDevRemountAttempts";
let mountedOnce = false;

function isMounted() {
  return document.documentElement.dataset[MOUNTED] === "true";
}

export function markMounted() {
  document.documentElement.dataset[MOUNTED] = "true";
  if (!import.meta.hot) return;
  mountedOnce = true;
  sessionStorage.removeItem(ATTEMPTS);
}

export const devRootOptions: RootOptions = import.meta.hot
  ? {
      onUncaughtError(error, info) {
        console.error("The window crashed and will reload on the next code change", error, info.componentStack);
        delete document.documentElement.dataset[MOUNTED];
      },
    }
  : {};

async function devServerReachable() {
  try {
    const response = await fetch("/", { cache: "no-store", signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

function watchUnmountedPage() {
  let lastLoadAt = performance.now();
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) lastLoadAt = Math.max(lastLoadAt, entry.startTime + entry.duration);
  });
  observer.observe({ type: "resource", buffered: true });

  const attempts = parseRemountAttempts(sessionStorage.getItem(ATTEMPTS));
  const delay = remountDelay(attempts);
  if (delay === null) {
    observer.disconnect();
    return;
  }

  const check = async () => {
    const step = nextRemountStep({ mounted: mountedOnce || isMounted(), sinceLastLoadMs: performance.now() - lastLoadAt });
    if (step.kind === "stop") {
      observer.disconnect();
      return;
    }
    if (step.kind === "wait") {
      window.setTimeout(() => void check(), step.ms);
      return;
    }
    if (!(await devServerReachable())) {
      window.setTimeout(() => void check(), delay);
      return;
    }
    if (mountedOnce || isMounted()) return;
    const attempt = parseRemountAttempts(sessionStorage.getItem(ATTEMPTS)) + 1;
    sessionStorage.setItem(ATTEMPTS, String(attempt));
    console.warn(`The window did not mount, reloading (attempt ${attempt})`);
    window.location.reload();
  };
  window.setTimeout(() => void check(), delay);
}

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", () => {
    if (isMounted()) return;
    sessionStorage.removeItem(ATTEMPTS);
    window.location.reload();
  });
  watchUnmountedPage();
}
