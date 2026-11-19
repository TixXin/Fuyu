import type { Child, Exec } from "../exec.ts";
import { HELPER_ARGS } from "./helperScript.ts";
import { parseHelperLine } from "./parse.ts";

export const HELPER_FILE = "powershell.exe";
export const HELPER_IDLE_MS = 60_000;
export const HELPER_TIMEOUT_MS = 15_000;
export const HELPER_MAX_FAILURES = 3;
export const HELPER_COOLDOWN_MS = 60_000;

export interface HelperDeps {
  exec: Exec;
  now(): number;
  after(callback: () => void, ms: number): () => void;
  idleMs?: number;
  timeoutMs?: number;
}

interface Pending {
  resolve(data: unknown): void;
  reject(error: Error): void;
  cancel(): void;
}

export class PowerShellHelper {
  private readonly deps: HelperDeps;
  private child: Child | null = null;
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private cancelIdle: (() => void) | null = null;
  private failures = 0;
  private coolUntil = 0;
  private disposed = false;
  starts = 0;

  constructor(deps: HelperDeps) {
    this.deps = deps;
  }

  get running(): boolean {
    return this.child !== null;
  }

  request(kind: string, argument = ""): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error("helper stopped"));
    if (this.deps.now() < this.coolUntil) return Promise.reject(new Error("helper failed repeatedly, waiting before retrying"));
    this.clearIdle();
    let child: Child;
    try {
      child = this.ensure();
    } catch (error) {
      this.fail();
      this.scheduleIdle();
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const cancel = this.deps.after(() => {
        if (!this.pending.has(id)) return;
        this.pending.delete(id);
        reject(new Error(`helper did not answer ${kind}`));
        this.fail();
        this.stop();
      }, this.deps.timeoutMs ?? HELPER_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (data) => {
          cancel();
          resolve(data);
        },
        reject: (error) => {
          cancel();
          reject(error);
        },
        cancel,
      });
      child.stdin?.write(`${id} ${kind}${argument ? ` ${argument}` : ""}\n`);
    });
  }

  stop(): void {
    this.clearIdle();
    const child = this.child;
    this.child = null;
    this.buffer = "";
    this.rejectAll(new Error("helper stopped"));
    child?.kill();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  private ensure(): Child {
    if (this.child) return this.child;
    const child = this.deps.exec.start(HELPER_FILE, HELPER_ARGS);
    this.starts += 1;
    this.child = child;
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      if (this.child === child) this.take(chunk);
    });
    child.stdin?.on("error", () => {});
    const gone = (reason: string) => {
      if (this.child !== child) return;
      this.child = null;
      this.buffer = "";
      if (this.pending.size > 0) this.fail();
      this.rejectAll(new Error(reason));
      this.clearIdle();
    };
    child.on("error", (error) => gone(`helper failed: ${error.message}`));
    child.on("exit", (code) => gone(`helper exited (${code ?? "signal"})`));
    return child;
  }

  private take(chunk: string): void {
    this.buffer += chunk;
    let index = this.buffer.indexOf("\n");
    while (index >= 0) {
      const line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      const reply = parseHelperLine(line);
      const waiting = reply ? this.pending.get(reply.id) : undefined;
      if (reply && waiting) {
        this.pending.delete(reply.id);
        this.failures = 0;
        if (reply.ok) waiting.resolve(reply.data);
        else waiting.reject(new Error(reply.error ?? "helper error"));
      }
      index = this.buffer.indexOf("\n");
    }
    if (this.pending.size === 0) this.scheduleIdle();
  }

  private fail(): void {
    this.failures += 1;
    if (this.failures >= HELPER_MAX_FAILURES) {
      this.failures = 0;
      this.coolUntil = this.deps.now() + HELPER_COOLDOWN_MS;
    }
  }

  private rejectAll(error: Error): void {
    const waiting = [...this.pending.values()];
    this.pending.clear();
    for (const entry of waiting) entry.reject(error);
  }

  private scheduleIdle(): void {
    this.clearIdle();
    if (!this.child) return;
    this.cancelIdle = this.deps.after(() => {
      this.cancelIdle = null;
      if (this.pending.size === 0) this.stop();
    }, this.deps.idleMs ?? HELPER_IDLE_MS);
  }

  private clearIdle(): void {
    if (this.cancelIdle) {
      this.cancelIdle();
      this.cancelIdle = null;
    }
  }
}
