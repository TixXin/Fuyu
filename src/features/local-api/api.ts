import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

const DOCS_URL = "https://github.com/TixXin/fuyu/blob/main/docs/features/local-api.md";

export type LocalApiInfo = {
  running: boolean;
  url: string;
  configPath: string;
};

export function getLocalApiInfo() {
  return invoke<LocalApiInfo>("get_local_api_info");
}

export function resetLocalApiToken() {
  return invoke<LocalApiInfo>("reset_local_api_token");
}

export function copyLocalApiToken() {
  return invoke<void>("copy_local_api_token");
}

export function openLocalApiDocs() {
  return openUrl(DOCS_URL);
}
