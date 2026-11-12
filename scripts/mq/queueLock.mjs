import { linkSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const POLL_MS = 200;
const STUCK_WARN_MS = 5 * 60 * 1000;

function alive(pid, me) {
  if (!pid) return false;
  if (pid === me) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function pidOf(ticket) {
  const dash = ticket.lastIndexOf("-");
  return dash === -1 ? 0 : Number(ticket.slice(dash + 1));
}

function removeQuietly(file) {
  try {
    unlinkSync(file);
  } catch {
    return;
  }
}

export function liveTickets(names, isAlive) {
  return names
    .filter((name) => isAlive(pidOf(name)))
    .sort((a, b) => {
      const [ta, pa] = a.split("-").map(Number);
      const [tb, pb] = b.split("-").map(Number);
      return ta - tb || pa - pb;
    });
}

export function createQueueLock(queueDir, { pid = process.pid, label = "", now = Date.now } = {}) {
  const tickets = path.join(queueDir, "tickets");
  const lockFile = path.join(queueDir, "lock");
  mkdirSync(tickets, { recursive: true });
  const ticketName = `${now()}-${pid}`;
  const ticketFile = path.join(tickets, ticketName);
  let held = false;

  const isAlive = (other) => alive(other, pid);

  function readHolder() {
    try {
      return JSON.parse(readFileSync(lockFile, "utf8"));
    } catch {
      return null;
    }
  }

  function queue() {
    let names = [];
    try {
      names = readdirSync(tickets);
    } catch {
      return [];
    }
    for (const name of names) if (!isAlive(pidOf(name))) removeQuietly(path.join(tickets, name));
    return liveTickets(names, isAlive);
  }

  function tryTake() {
    const temp = `${lockFile}.${pid}.tmp`;
    writeFileSync(temp, JSON.stringify({ pid, label, ts: now() }));
    try {
      linkSync(temp, lockFile);
      removeQuietly(temp);
      return true;
    } catch (error) {
      removeQuietly(temp);
      if (error.code !== "EEXIST") throw error;
      const holder = readHolder();
      if (!holder || !isAlive(holder.pid)) removeQuietly(lockFile);
      return false;
    }
  }

  function release() {
    if (held) {
      const holder = readHolder();
      if (holder?.pid === pid) removeQuietly(lockFile);
      held = false;
    }
    removeQuietly(ticketFile);
  }

  async function acquire({ onWait } = {}) {
    writeFileSync(ticketFile, JSON.stringify({ pid, label, ts: now() }));
    let announced = -1;
    let warned = 0;
    for (;;) {
      const ahead = queue().indexOf(ticketName);
      const holder = readHolder();
      const free = !holder || !isAlive(holder.pid);
      if (ahead <= 0 && free && tryTake()) {
        held = true;
        removeQuietly(ticketFile);
        return;
      }
      if (ahead > 0 && ahead !== announced) {
        announced = ahead;
        onWait?.({ ahead });
      } else if (ahead <= 0 && holder && !free) {
        if (announced !== 0) {
          announced = 0;
          onWait?.({ ahead: 0, holder });
        }
        const due = Math.floor((now() - holder.ts) / STUCK_WARN_MS);
        if (due > warned) {
          warned = due;
          onWait?.({ ahead: 0, holder, stuckMs: now() - holder.ts });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }

  process.on("exit", release);
  return { acquire, release, get held() { return held; } };
}
