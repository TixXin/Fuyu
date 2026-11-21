import { invoke } from "@tauri-apps/api/core";

export function setFollowDisplayRate(follow: boolean) {
  return invoke<void>("set_webview_follow_display_rate", { follow });
}
