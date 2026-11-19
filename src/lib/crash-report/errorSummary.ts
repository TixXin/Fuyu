export const MAX_SUMMARY_MESSAGE_CHARS = 500;
export const MAX_SUMMARY_STACK_CHARS = 2000;

export type ErrorSummary = { message: string; stack: string | null };

const ORIGIN = /\b[a-z][a-z0-9+.-]*:\/\/[^/\s)]+\//gi;
const NOISE = [/^ResizeObserver loop/i, /^Script error\.?$/i];

function cut(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function describe(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  try {
    const json = JSON.stringify(value);
    if (typeof json === "string" && json !== "{}") return json;
  } catch {
    return Object.prototype.toString.call(value);
  }
  return Object.prototype.toString.call(value);
}

function stackFrames(error: Error, message: string): string {
  const raw = typeof error.stack === "string" ? error.stack : "";
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const head = lines[0] ?? "";
  const hasHeader = head === message || head === error.name || (error.message !== "" && head.endsWith(error.message));
  const frames = hasHeader ? lines.slice(1) : lines;
  return frames.join("\n");
}

export function summarizeError(error: unknown, componentStack?: string | null): ErrorSummary {
  const isError = error instanceof Error;
  const message = isError ? `${error.name || "Error"}: ${error.message}` : describe(error);
  const components = (componentStack ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join("\n");
  const stack = [isError ? stackFrames(error, message) : "", components].filter(Boolean).join("\n").replace(ORIGIN, "");
  return {
    message: cut(message.trim() || "unknown error", MAX_SUMMARY_MESSAGE_CHARS),
    stack: stack ? cut(stack, MAX_SUMMARY_STACK_CHARS) : null,
  };
}

export function isNoise(message: string): boolean {
  return NOISE.some((pattern) => pattern.test(message));
}

export function createReportLimiter(max: number): (key: string) => boolean {
  const seen = new Set<string>();
  return (key) => {
    if (seen.has(key) || seen.size >= max) return false;
    seen.add(key);
    return true;
  };
}
