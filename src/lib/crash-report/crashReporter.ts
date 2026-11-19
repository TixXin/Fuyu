import { closeCurrentWindow, reportFrontendError, restartApp, revealCrashLog, type FrontendErrorKind } from "./api";
import { createReportLimiter, isNoise, summarizeError } from "./errorSummary";
import { nextCrashStep, parseReloadAt, retryFailed, type CrashOutcome, type CrashStep } from "./recovery";

const RELOAD_AT = "fuyuCrashReloadAt";
const RETRY_AT = "fuyuCrashRetryAt";
const MAX_REPORTS = 20;
const RELOAD_GRACE_MS = 400;
const allow = createReportLimiter(MAX_REPORTS);

function readTime(key: string): number | null {
  try {
    return parseReloadAt(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeTime(key: string, at: number) {
  try {
    sessionStorage.setItem(key, String(at));
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
  writeTime(RELOAD_AT, Date.now());
  window.location.reload();
}

export function retryWindow() {
  writeTime(RETRY_AT, Date.now());
  reloadWindow();
}

export function restartFuyu() {
  void restartApp().catch((error: unknown) => console.error("Failed to restart the app", error));
}

export function openCrashLog() {
  void revealCrashLog().catch((error: unknown) => console.error("Failed to show the error log", error));
}

export function closeWindow() {
  void closeCurrentWindow().catch((error: unknown) => console.error("Failed to close the window", error));
}

export function handleCrash(kind: FrontendErrorKind, error: unknown, componentStack?: string | null): CrashStep {
  const sent = reportCrash(kind, error, componentStack);
  const step = nextCrashStep({ now: Date.now(), lastReloadAt: readTime(RELOAD_AT), dev: Boolean(import.meta.hot) });
  if (step === "reload") {
    const grace = new Promise<void>((resolve) => window.setTimeout(resolve, RELOAD_GRACE_MS));
    void Promise.race([sent, grace]).then(reloadWindow);
  }
  return step;
}

export function crashOutcome(kind: FrontendErrorKind, error: unknown, componentStack?: string | null): CrashOutcome {
  const retried = retryFailed({ now: Date.now(), lastRetryAt: readTime(RETRY_AT) });
  return { step: handleCrash(kind, error, componentStack), retried };
}

export function installCrashReporting() {
  window.addEventListener("error", (event) => void reportCrash("error", event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => void reportCrash("rejection", event.reason));
}
