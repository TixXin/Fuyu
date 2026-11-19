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
  }
}
