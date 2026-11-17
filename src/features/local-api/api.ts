import { invoke } from "@tauri-apps/api/core";

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
