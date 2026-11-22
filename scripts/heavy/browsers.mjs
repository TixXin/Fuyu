import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { alive, readSlots, readTickets, sleepSync, writeTicket } from "./queue.mjs";

const NOTE_EVERY_MS = 30_000;
const RUNNER = /(^|[\\/])run-regression\.mjs$/;

export function isRegression(command) {
  return command.some((word) => RUNNER.test(String(word)));
}

export function browserCap(env = process.env, cpus = os.availableParallelism()) {
  const set = Number(env.FUYU_HEAVY_BROWSERS);
  if (Number.isInteger(set) && set > 0) return set;
  return Math.max(2, Math.floor(cpus / 2));
}

function wholeNumber(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function wantedBrowsers(command, env = process.env) {
  const words = command.map(String);
  const at = words.lastIndexOf("--jobs");
  return wholeNumber(at === -1 ? env.REGRESSION_JOBS : words[at + 1]) ?? 1;
}

export function withBrowsers(command, granted) {
  const words = command.map(String);
  const at = words.lastIndexOf("--jobs");
  if (at === -1) return [...words, "--jobs", String(granted)];
  return words.map((word, index) => (index === at + 1 ? String(granted) : word));
}

const minutes = (since, now) => Math.max(0, Math.round((now - since) / 60_000));

export function browserNote({ cap, held, ahead, now }) {
  const runs = new Map();
  for (const entry of held) {
    const key = entry.pid ?? entry.name;
    const seen = runs.get(key);
    runs.set(key, { ...entry, count: (seen?.count ?? 0) + 1 });
  }
  const running = [...runs.values()].map((entry) => `${entry.label}（${entry.count} 个，${minutes(entry.since, now)} 分钟，pid ${entry.pid ?? "?"}）`).join("、") || "无";
  return `[heavy] 这台机器同时最多开 ${cap} 个回归页浏览器（和 Rust 构建的名额分开）。正在用：${running}；你排在第 ${ahead + 1} 位，轮到了会自动开始。`;
}

function claim(dir, cap, count, owner) {
  const taken = [];
  for (let index = 0; index < cap && taken.length < count; index += 1) {
    const slot = path.join(dir, `browser-${index}`);
    try {
      mkdirSync(slot);
    } catch {
      continue;
    }
    writeFileSync(path.join(slot, "owner.json"), JSON.stringify(owner));
    taken.push(slot);
  }
  return taken;
}

export function acquireBrowsers({
  label,
  want,
  dir,
  cap,
  isAlive = alive,
  now = Date.now,
  sleep = sleepSync,
  log = console.log,
  pollMs = 2000,
  pid = process.pid,
}) {
  const queue = path.join(dir, "browser-queue");
  const slotDir = path.join(dir, "browsers");
  mkdirSync(queue, { recursive: true });
  mkdirSync(slotDir, { recursive: true });
  const owner = { pid, label, cwd: process.cwd(), since: now() };
  const ticket = writeTicket(queue, owner);
  let noted = 0;
  try {
    for (;;) {
      const held = readSlots(slotDir, { isAlive, now });
      const ahead = readTickets(queue, isAlive).filter((entry) => entry.name < ticket).length;
      const free = cap - held.length;
      if (free > 0 && ahead === 0) {
        const taken = claim(slotDir, cap, Math.min(want, free), { ...owner, since: now() });
        if (taken.length) {
          return {
            granted: taken.length,
            release: () => {
              for (const slot of taken) rmSync(slot, { recursive: true, force: true });
            },
          };
        }
      }
      if (now() - noted >= NOTE_EVERY_MS) {
        log(browserNote({ cap, held, ahead, now: now() }));
        noted = now();
      }
      sleep(pollMs);
    }
  } finally {
    rmSync(path.join(queue, ticket), { force: true });
  }
}
