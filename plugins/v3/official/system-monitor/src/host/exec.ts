import { execFile, spawn, type ChildProcess } from "node:child_process";

export type Child = ChildProcess;

export interface RunOptions {
  timeoutMs?: number;
}

export interface CommandError extends Error {
  missing?: boolean;
}

export interface Exec {
  run(file: string, args: readonly string[], options?: RunOptions): Promise<string>;
  start(file: string, args: readonly string[]): Child;
  launch(file: string, args: readonly string[]): Promise<void>;
}

export function commandError(message: string, missing = false): CommandError {
  const error: CommandError = new Error(message);
  error.missing = missing;
  return error;
}

export function isMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as CommandError).missing);
}

export const nodeExec: Exec = {
  run(file, args, options = {}) {
    return new Promise((resolve, reject) => {
      execFile(
        file,
        args,
        { encoding: "utf8", timeout: options.timeoutMs ?? 5000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
        (error, stdout) => {
          if (error) {
            reject(commandError(`${file}: ${error.message}`, error.code === "ENOENT"));
            return;
          }
          resolve(stdout);
        },
      );
    });
  },
  start(file, args) {
    return spawn(file, args, { stdio: "pipe", windowsHide: true });
  },
  launch(file, args) {
    return new Promise((resolve, reject) => {
      const child = spawn(file, args, { detached: true, stdio: "ignore", windowsHide: false });
      let settled = false;
      child.on("error", (error) => {
        if (settled) return;
        settled = true;
        reject(commandError(`${file}: ${error.message}`));
      });
      child.on("exit", (code) => {
        if (settled) return;
        settled = true;
        if (code === 0 || code === null) resolve();
        else reject(commandError(`${file} exited with ${code}`));
      });
      child.unref();
    });
  },
};
