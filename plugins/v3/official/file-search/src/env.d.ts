declare const process: {
  readonly platform: string;
  readonly env: Record<string, string | undefined>;
};

declare module "node:child_process" {
  export interface SpawnOptions {
    detached?: boolean;
    stdio?: "ignore" | "inherit" | "pipe";
    windowsHide?: boolean;
  }
  export interface Readable {
    setEncoding(encoding: "utf8"): void;
    on(event: "data", listener: (chunk: string) => void): this;
  }
  export interface ChildProcess {
    readonly stdout: Readable | null;
    readonly stderr: Readable | null;
    on(event: "error", listener: (error: Error & { code?: string }) => void): this;
    on(event: "close", listener: (code: number | null) => void): this;
    kill(): boolean;
    unref(): void;
  }
  export function spawn(command: string, args: readonly string[], options?: SpawnOptions): ChildProcess;
}

declare module "node:fs" {
  export interface Dirent {
    readonly name: string;
    isDirectory(): boolean;
  }
  export interface Stats {
    readonly mtimeMs: number;
  }
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string, encoding: "utf8"): void;
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function statSync(path: string): Stats;
}

declare module "node:os" {
  export function homedir(): string;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}
