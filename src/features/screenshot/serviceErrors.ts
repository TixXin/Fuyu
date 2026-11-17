export function isOff(error: unknown) {
  return (error as { code?: unknown } | null)?.code === "not-ready";
}

export function reasonOf(error: unknown): unknown {
  const { code, message, data } = (error ?? {}) as { code?: unknown; message?: unknown; data?: { reason?: unknown; args?: unknown; detail?: unknown } };
  if (typeof data?.reason !== "string" || data.reason === "failed") return error;
  return { code: data.reason, message: typeof message === "string" ? message : String(code), args: data.args, detail: data.detail };
}

export function serviceFailed(error: unknown, off: string, errorText: (error: unknown) => string) {
  return isOff(error) ? off : errorText(reasonOf(error));
}
