import type { ErrorArgs, ErrorCode } from "./sections/errors";
import type { Translations } from "./types";

export type NativeError = {
  code: string;
  args?: ErrorArgs;
  detail?: string;
  message: string;
};

export function isNativeError(value: unknown): value is NativeError {
  if (!value || typeof value !== "object") return false;
  const { code, message } = value as Record<string, unknown>;
  return typeof code === "string" && typeof message === "string";
}

export function errorText(error: unknown, t: Pick<Translations, "errors">): string {
  if (isNativeError(error)) {
    const wording = (t.errors.codes as Partial<Record<string, (typeof t.errors.codes)[ErrorCode]>>)[error.code];
    const text = wording === undefined ? error.message : typeof wording === "function" ? wording(error.args ?? {}) : wording;
    return error.detail ? t.errors.withDetail(text, error.detail) : text;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
