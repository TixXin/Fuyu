export const MAX_COMPILE_ERROR_CHARS = 200;

export type CompileErrorInput = {
  message?: unknown;
  id?: unknown;
  loc?: { file?: unknown; line?: unknown; column?: unknown } | null;
};

export type CompileErrorSummary = { where: string; message: string };

const HEADER = /^Transform failed with \d+ errors?:?$/i;
const PATH_PREFIX = /^(?:[A-Za-z]:)?[\\/][^\s:]*(?::\d+)*:\s*/;
const PATH_IN_TEXT = /(?:[A-Za-z]:)?[\\/][^\s:]+\.[A-Za-z]+/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function position(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? `:${value}` : "";
}

export function compileErrorSummary(error: CompileErrorInput | null | undefined): CompileErrorSummary {
  const raw = text(error?.message);
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !HEADER.test(line));
  const first = lines[0] ?? "";
  const path = text(error?.loc?.file) || text(error?.id) || (PATH_IN_TEXT.exec(first)?.[0] ?? "");
  const name = path.split(/[\\/]/).pop()?.split("?")[0] ?? "";
  const line = position(error?.loc?.line);
  const where = name ? `${name}${line}${line ? position(error?.loc?.column) : ""}` : "";
  const message = first.replace(PATH_PREFIX, "").replace(/^ERROR:\s*/i, "").trim() || "The code does not compile";
  return { where, message: message.length > MAX_COMPILE_ERROR_CHARS ? `${message.slice(0, MAX_COMPILE_ERROR_CHARS)}…` : message };
}
