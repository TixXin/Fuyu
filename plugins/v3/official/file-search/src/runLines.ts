import { spawn } from "node:child_process";

export interface RunOutcome {
  lines: string[];
  code: number | null;
  missing: boolean;
  timedOut: boolean;
  truncated: boolean;
  stderr: string;
}

export interface RunOptions {
  maxLines: number;
  timeoutMs: number;
  schedule: (callback: () => void, ms: number) => () => void;
}

export function runLines(command: string, args: readonly string[], options: RunOptions): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const lines: string[] = [];
    let pending = "";
    let stderr = "";
    let truncated = false;
    let timedOut = false;
    let settled = false;
    let cancelTimer: () => void = () => undefined;

    const finish = (outcome: Partial<RunOutcome>) => {
      if (settled) return;
      settled = true;
      cancelTimer();
      if (pending.trim() && lines.length < options.maxLines) lines.push(pending);
      resolve({ lines, code: null, missing: false, timedOut, truncated, stderr: stderr.slice(0, 400), ...outcome });
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, { stdio: "pipe", windowsHide: true });
    } catch {
      finish({ missing: true });
      return;
    }

    cancelTimer = options.schedule(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (truncated) return;
      pending += chunk;
      const parts = pending.split("\n");
      pending = parts.pop() ?? "";
      for (const part of parts) {
        if (lines.length >= options.maxLines) {
          truncated = true;
          break;
        }
        lines.push(part);
      }
      if (lines.length >= options.maxLines && (truncated || pending.length > 0)) {
        truncated = true;
        pending = "";
        child.kill();
      }
    });
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length < 4000) stderr += chunk;
    });
    child.on("error", (error: Error & { code?: string }) => {
      finish({ missing: error.code === "ENOENT" });
    });
    child.on("close", (code: number | null) => {
      finish({ code: truncated ? 0 : code });
    });
  });
}
