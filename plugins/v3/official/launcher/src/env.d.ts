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
  export interface ChildProcess {
    on(event: "error", listener: (error: Error) => void): this;
    unref(): void;
  }
  export function spawn(command: string, args: readonly string[], options?: SpawnOptions): ChildProcess;
}

declare module "node:fs" {
  export interface Dirent {
    readonly name: string;
    isDirectory(): boolean;
    isFile(): boolean;
    isSymbolicLink(): boolean;
  }
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string, encoding?: "utf8"): void;
}

declare module "node:os" {
  export function homedir(): string;
}

declare module "node:path" {
  export interface PlatformPath {
    readonly sep: string;
    readonly delimiter: string;
    join(...paths: string[]): string;
  }
  export const sep: string;
  export const delimiter: string;
  export const posix: PlatformPath;
  export const win32: PlatformPath;
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare module "cordis" {
  interface Context {
    readonly dataDir: string;
  }
}
