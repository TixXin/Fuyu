declare module "node:child_process" {
  export interface ExecFileOptions {
    encoding: "utf8";
    timeout?: number;
    maxBuffer?: number;
    windowsHide?: boolean;
  }
  export interface ExecFileError extends Error {
    code?: string | number | null;
    killed?: boolean;
  }
  export function execFile(
    file: string,
    args: readonly string[],
    options: ExecFileOptions,
    callback: (error: ExecFileError | null, stdout: string, stderr: string) => void,
  ): unknown;
  export interface SpawnOptions {
    detached?: boolean;
    stdio?: "ignore" | "pipe";
    windowsHide?: boolean;
  }
  export interface Readable {
    setEncoding(encoding: "utf8"): void;
    on(event: "data", listener: (chunk: string) => void): this;
  }
  export interface Writable {
    write(chunk: string): boolean;
    end(): void;
    on(event: "error", listener: (error: Error) => void): this;
  }
  export interface ChildProcess {
    readonly stdin: Writable | null;
    readonly stdout: Readable | null;
    readonly stderr: Readable | null;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
    kill(): boolean;
    unref(): void;
  }
  export function spawn(command: string, args: readonly string[], options?: SpawnOptions): ChildProcess;
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string, encoding?: "utf8"): void;
}

declare module "node:os" {
  export interface CpuTimes {
    user: number;
    nice: number;
    sys: number;
    idle: number;
    irq: number;
  }
  export interface CpuInfo {
    model: string;
    speed: number;
    times: CpuTimes;
  }
  export function cpus(): CpuInfo[];
  export function totalmem(): number;
  export function freemem(): number;
  export function uptime(): number;
  export function hostname(): string;
  export function arch(): string;
  export function platform(): string;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
}

declare module "cordis" {
  interface Context {
    readonly dataDir: string;
    effect(execute: () => () => void, label?: string): () => Promise<void>;
  }
}
