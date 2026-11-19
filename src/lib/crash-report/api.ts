import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type FrontendErrorKind = "render" | "uncaught" | "startup" | "error" | "rejection" | "slot";

export function reportFrontendError(kind: FrontendErrorKind, message: string, stack: string | null) {
  return invoke<void>("report_frontend_error", { kind, message, stack });
}

export function closeCurrentWindow() {
  return getCurrentWindow().close();
}
