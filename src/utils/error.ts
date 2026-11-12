export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const { message, detail } = error as Record<string, unknown>;
    if (typeof message === "string") return typeof detail === "string" && detail ? `${message.replace(/\.$/, "")}: ${detail}` : message;
  }
  return String(error);
}
