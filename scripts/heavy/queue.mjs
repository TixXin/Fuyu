import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const HEAVY_ENV = "FUYU_HEAVY";
const NOTE_EVERY_MS = 30_000;
const UNCLAIMED_SLOT_MS = 30_000;

export function queueDir(env = process.env) {
  return env.FUYU_HEAVY_DIR || path.join(os.homedir(), ".cache", "fuyu-heavy");
}

export function slotCount(env = process.env, cpus = os.availableParallelism()) {
  const set = Number(env.FUYU_HEAVY_SLOTS);
  if (Number.isInteger(set) && set > 0) return set;
  return Math.max(1, Math.floor(cpus / 5));
}

export function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

export function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function list(dir) {
  try {
    return readdirSync(dir).filter((name) => !name.startsWith(".")).sort();
  } catch {
    return [];
  }
}

export function readTickets(dir, isAlive = alive) {
  const tickets = [];
  for (const name of list(dir)) {
    const file = path.join(dir, name);
    const data = readJson(file);
    if (!data) continue;
    if (!isAlive(data.pid)) {
      rmSync(file, { force: true });
      continue;
    }
    tickets.push({ name, ...data });
  }
  return tickets;
}

export function readSlots(dir, { isAlive = alive, now = Date.now } = {}) {
  const held = [];
  for (const name of list(dir)) {
    const slot = path.join(dir, name);
    const owner = readJson(path.join(slot, "owner.json"));
    if (owner && !isAlive(owner.pid)) {
      rmSync(slot, { recursive: true, force: true });
      continue;
    }
    if (!owner) {
      let age = 0;
      try {
        age = now() - statSync(slot).mtimeMs;
      } catch {
        continue;
      }
      if (age > UNCLAIMED_SLOT_MS) {
        rmSync(slot, { recursive: true, force: true });
        continue;
      }
    }
    held.push({ name, ...(owner ?? { label: "?", since: now() }) });
  }
  return held;
}

export function canRun({ slots, held, ahead }) {
  const free = slots - held;
  return free > 0 && ahead < free;
}

const minutes = (since, now) => Math.max(0, Math.round((now - since) / 60_000));

export function waitingNote({ slots, held, ahead, now }) {
  const running = held.map((entry) => `${entry.label}（${minutes(entry.since, now)} 分钟，pid ${entry.pid ?? "?"}）`).join("、") || "无";
  return `[heavy] 这台机器同时最多跑 ${slots} 个重任务。正在跑：${running}；你排在第 ${ahead + 1} 位，轮到了会自动开始。`;
}

function writeTicket(dir, ticket) {
  const name = `${String(ticket.since).padStart(15, "0")}-${ticket.pid}.json`;
  const temp = path.join(dir, `.${name}`);
  writeFileSync(temp, JSON.stringify(ticket));
  renameSync(temp, path.join(dir, name));
  return name;
}

function claimSlot(dir, slots, owner) {
  for (let index = 0; index < slots; index += 1) {
    const slot = path.join(dir, `slot-${index}`);
    try {
      mkdirSync(slot);
    } catch {
      continue;
    }
    writeFileSync(path.join(slot, "owner.json"), JSON.stringify(owner));
    return slot;
  }
  return null;
}

export function acquire({
  label,
  dir = queueDir(),
  slots = slotCount(),
  isAlive = alive,
  now = Date.now,
  sleep = sleepSync,
  log = console.log,
  pollMs = 2000,
  pid = process.pid,
} = {}) {
  const queue = path.join(dir, "queue");
  const slotDir = path.join(dir, "slots");
  mkdirSync(queue, { recursive: true });
  mkdirSync(slotDir, { recursive: true });
  const owner = { pid, label, cwd: process.cwd(), since: now() };
  const ticket = writeTicket(queue, owner);
  let noted = 0;
  try {
    for (;;) {
      const held = readSlots(slotDir, { isAlive, now });
      const ahead = readTickets(queue, isAlive).filter((entry) => entry.name < ticket).length;
      if (canRun({ slots, held: held.length, ahead })) {
        const slot = claimSlot(slotDir, slots, { ...owner, since: now() });
        if (slot) return () => rmSync(slot, { recursive: true, force: true });
      }
      if (now() - noted >= NOTE_EVERY_MS) {
        log(waitingNote({ slots, held, ahead, now: now() }));
        noted = now();
      }
      sleep(pollMs);
    }
  } finally {
    rmSync(path.join(queue, ticket), { force: true });
  }
}
