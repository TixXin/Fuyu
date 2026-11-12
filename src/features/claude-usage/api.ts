import { invoke } from "@tauri-apps/api/core";

export function refreshClaudeUsage() {
  return invoke<void>("refresh_claude_usage");
}
