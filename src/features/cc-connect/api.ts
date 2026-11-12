import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { NativeError } from "../../i18n/nativeError";

export function openCcConnectLink(url: string) {
  return openUrl(url);
}

export const CC_CONNECT_PLUGIN_ID = "focusd.cc-connect";

export type CcConnectChat = { key: string; platform: string; userName: string | null };

export type CcConnectProject = { name: string; agent: string | null; chats: CcConnectChat[] };

export const CC_CONNECT_SETUP_AGENTS = ["claudecode", "codex"] as const;
export type CcConnectSetupAgent = (typeof CC_CONNECT_SETUP_AGENTS)[number];

export const CC_CONNECT_AGENT_LABELS: Record<string, string> = { claudecode: "Claude Code", codex: "Codex" };

export type CcConnectRemoteStatus = {
  exe: string | null;
  running: boolean;
  projects: CcConnectProject[];
};

export type CcConnectRunState = "off" | "starting" | "running" | "external" | "noConfig" | "failed";

export type CcConnectStatus = {
  exe: string | null;
  exeSource: "setting" | "running" | "path" | "downloaded" | "installed" | null;
  exeError: NativeError | string | null;
  running: boolean;
  runner: CcConnectRunState;
  runnerError: NativeError | string | null;
  dataDir: string;
  defaultWorkDir: string | null;
  config: boolean;
  configProjects: string[];
  projects: CcConnectProject[];
};

export const CC_CONNECT_SETUP_PLATFORMS = ["telegram", "discord", "feishu"] as const;
export type CcConnectSetupPlatform = (typeof CC_CONNECT_SETUP_PLATFORMS)[number];

export type CcConnectBotCheck = { name: string; inviteUrl: string | null; senders: { id: string; name: string }[] };

export type CcConnectFeishuSetup = {
  running: boolean;
  qr: string | null;
  url: string | null;
  done: boolean;
  allowFrom: string | null;
  error: NativeError | string | null;
};

export type CcConnectNewProject = {
  project: string;
  agent: CcConnectSetupAgent;
  workDir: string;
  platform: CcConnectSetupPlatform;
  token: string;
  allowFrom: string;
};

export function getCcConnectStatus(path: string) {
  return invoke<CcConnectStatus>("get_cc_connect_status", { path: path.trim() || null });
}

export function sendCcConnectMessage(path: string, project: string, sessionKey: string, text: string) {
  return invoke<void>("send_cc_connect_message", { path: path.trim() || null, project, sessionKey, text });
}

export function getCcConnectRemoteStatus(host: string, path: string) {
  return invoke<CcConnectRemoteStatus>("get_cc_connect_remote_status", { host, path: path.trim() || null });
}

export function sendCcConnectRemoteMessage(host: string, path: string, project: string, sessionKey: string, text: string) {
  return invoke<void>("send_cc_connect_remote_message", { host, path: path.trim() || null, project, sessionKey, text });
}

export function installCcConnect() {
  return invoke<string>("install_cc_connect");
}

export function checkCcConnectBot(platform: CcConnectSetupPlatform, token: string) {
  return invoke<CcConnectBotCheck>("check_cc_connect_bot", { platform, token });
}

export function addCcConnectProject(path: string, project: CcConnectNewProject) {
  return invoke<void>("add_cc_connect_project", { path: path.trim() || null, ...project });
}

export function getCcConnectFeishuSetup() {
  return invoke<CcConnectFeishuSetup>("get_cc_connect_feishu_setup");
}

export function cancelCcConnectFeishuSetup() {
  return invoke<void>("cancel_cc_connect_feishu_setup");
}

export function freeProjectName(taken: string[], base = "phone") {
  for (let index = 1; ; index += 1) {
    const name = index === 1 ? base : `${base}-${index}`;
    if (!taken.includes(name)) return name;
  }
}

export function allowFromValid(allowFrom: string) {
  const ids = allowFrom.split(",").map((id) => id.trim());
  return ids.every((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id));
}

export function programSetting(settings: Record<string, unknown>) {
  return typeof settings.path === "string" ? settings.path : "";
}

export function chatLabel(chat: CcConnectChat, platforms: Record<string, string>) {
  const platform = platforms[chat.platform] ?? chat.platform;
  return chat.userName ? `${platform} · ${chat.userName}` : platform;
}
