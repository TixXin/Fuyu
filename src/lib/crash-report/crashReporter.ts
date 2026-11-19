import { closeCurrentWindow, reportFrontendError, type FrontendErrorKind } from "./api";
import { createReportLimiter, isNoise, summarizeError } from "./errorSummary";
import { nextCrashStep, parseReloadAt, type CrashStep } from "./recovery";

const RELOAD_AT = "fuyuCrashReloadAt";
const MAX_REPORTS = 20;
const RELOAD_GRACE_MS = 400;
const allow = createReportLimiter(MAX_REPORTS);

function readReloadAt(): number | null {
  try {
    return parseReloadAt(sessionStorage.getItem(RELOAD_AT));
  } catch {
    return null;
  }
}

function writeReloadAt(at: number) {
  try {
    sessionStorage.setItem(RELOAD_AT, String(at));
  } catch {
    return;
  }
}

export function reportCrash(kind: FrontendErrorKind, error: unknown, componentStack?: string | null): Promise<void> {
  const summary = summarizeError(error, componentStack);
  if (isNoise(summary.message) || !allow(`${kind}:${summary.message}`)) return Promise.resolve();
  try {
    return reportFrontendError(kind, summary.message, summary.stack).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

export function reloadWindow() {
  writeReloadAt(Date.now());
  window.location.reload();
}

export function closeWindow() {
  void closeCurrentWindow().catch((error: unknown) => console.error("Failed to close the window", error));
}

export function handleCrash(kind: FrontendErrorKind, error: unknown, componentStack?: string | null): CrashStep {
  const sent = reportCrash(kind, error, componentStack);
  const step = nextCrashStep({ now: Date.now(), lastReloadAt: readReloadAt(), dev: Boolean(import.meta.hot) });
  if (step === "reload") {
    const grace = new Promise<void>((resolve) => window.setTimeout(resolve, RELOAD_GRACE_MS));
    void Promise.race([sent, grace]).then(reloadWindow);
  }
  return step;
}

export function installCrashReporting() {
  window.addEventListener("error", (event) => void reportCrash("error", event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => void reportCrash("rejection", event.reason));
}
