import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { signingDir } from "../signing-dir.mjs";

const BODY_MAX = 320;
const GROUP = "Fuyu 发版";

export function barkConfigPath(home = homedir(), exists = existsSync) {
  return join(signingDir(home, exists), "bark.json");
}

export function barkConfig(env = process.env, { path = barkConfigPath(), read = readFileSync, exists = existsSync } = {}) {
  if (env.FUYU_BARK === "0") return null;
  let file = {};
  if (exists(path)) {
    try {
      file = JSON.parse(read(path, "utf8").replace(/^﻿/, ""));
    } catch {
      file = {};
    }
  }
  const endpoint = String(env.FUYU_BARK_ENDPOINT || file.endpoint || "").trim().replace(/\/+$/, "");
  const listed = env.FUYU_BARK_KEYS ? env.FUYU_BARK_KEYS.split(",") : Array.isArray(file.deviceKeys) ? file.deviceKeys : [];
  const deviceKeys = [...new Set(listed.map((key) => String(key).trim()).filter(Boolean))];
  if (!/^https:\/\//.test(endpoint) || deviceKeys.length === 0) return null;
  return { endpoint, deviceKeys };
}

export function barkPayload(deviceKey, title, body, { level } = {}) {
  const text = String(body ?? "").replace(/\x1b\[[0-9;]*m/g, "").trim();
  return {
    device_key: deviceKey,
    title,
    body: text.length > BODY_MAX ? `${text.slice(0, BODY_MAX - 1)}…` : text,
    group: GROUP,
    ...(level ? { level } : {}),
  };
}

function curlPost(url, json) {
  const result = spawnSync("curl", ["-sS", "-m", "8", "-o", process.platform === "win32" ? "NUL" : "/dev/null", "-w", "%{http_code}", "-H", "content-type: application/json; charset=utf-8", "--data-binary", "@-", url], {
    input: json,
    encoding: "utf8",
    windowsHide: true,
  });
  return result.status === 0 && result.stdout.trim() === "200";
}

export function createNotifier({ config = barkConfig(), post = curlPost, prefix = "" } = {}) {
  let failed = false;
  const send = (title, body, options) => {
    if (!config) return false;
    let sent = 0;
    for (const key of config.deviceKeys) {
      if (post(`${config.endpoint}/push`, JSON.stringify(barkPayload(key, `${prefix}${title}`, body, options)))) sent += 1;
    }
    if (sent === 0 && !failed) {
      failed = true;
      console.error("  ! Could not push to Bark; the release goes on without phone notices.");
    }
    return sent > 0;
  };
  return {
    enabled: Boolean(config),
    send,
    step: (message) => send("进度", message),
    problem: (message) => send("出问题了", message, { level: "timeSensitive" }),
    finished: (message) => send("完成", message, { level: "timeSensitive" }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [title, ...words] = process.argv.slice(2);
  const notifier = createNotifier();
  if (!notifier.enabled) {
    console.error(`Bark is not set up: write ${barkConfigPath()} as { "endpoint": "https://…", "deviceKeys": ["…"] }.`);
    process.exit(1);
  }
  process.exit(notifier.send(title || "Fuyu", words.join(" ")) ? 0 : 1);
}
