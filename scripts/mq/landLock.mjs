import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { alive } from "../heavy/queue.mjs";
import { tryGit } from "./settings.mjs";

export function landLockPath() {
  const common = tryGit(["rev-parse", "--git-common-dir"]).out.trim() || ".git";
  return path.join(common, "fuyu-land.lock");
}

function readHolder(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export function takeLandLock({ file = landLockPath(), isAlive = alive, now = Date.now, pid = process.pid, host = hostname() } = {}) {
  const me = { pid, host, since: now() };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(file, JSON.stringify(me), { flag: "wx" });
      return { ok: true, release: () => rmSync(file, { force: true }) };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const holder = readHolder(file);
    if (holder && isAlive(holder.pid)) return { ok: false, holder };
    rmSync(file, { force: true });
  }
  return { ok: false, holder: readHolder(file) };
}

export function landBusyNote(holder, now = Date.now()) {
  const minutes = Number.isFinite(holder?.since) ? Math.max(0, Math.round((now - holder.since) / 60_000)) : "?";
  return [
    `[land] 已经有一个整批 land 在跑（pid ${holder?.pid ?? "?"}，${minutes} 分钟前开始），这次不再重复推送。`,
    "  它推的是它开始那一刻的本地 main，在那之前提交的都会一起带上去；之后的新提交，等它推完再 pnpm mq:land --yes。",
    "  只想单独合入几个提交用 pnpm mq:land --yes --only <提交号…>，不受这个限制。",
  ].join("\n");
}
