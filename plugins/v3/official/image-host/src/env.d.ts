declare module "node:fs" {
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function readFileSync(path: string): Uint8Array;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function writeFileSync(path: string, data: string, encoding?: "utf8"): void;
}

declare module "node:path" {
  export function join(...paths: string[]): string;
}

declare module "node:crypto" {
  interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(): Uint8Array;
    digest(encoding: "hex"): string;
  }
  export function createHash(algorithm: "sha256"): Hash;
  export function createHmac(algorithm: "sha256", key: string | Uint8Array): Hash;
  export function randomBytes(size: number): { toString(encoding: "hex"): string };
}

type ScreenshotActionRun = {
  path: string;
  saved: boolean;
  thumbnail: string | null;
  text: string | null;
  source: { app: string; title: string | null; url: string | null } | null;
  locale: "zh-CN" | "en";
};

declare module "cordis" {
  interface Context {
    readonly dataDir: string;
    readonly screenshotActions: {
      register(spec: {
        id: string;
        label: { "zh-CN": string; en: string };
        icon?: "inbox" | "bot" | "sparkles" | "share" | "copy" | "pin" | "wand" | "notebook" | "list-todo";
        order?: number;
        keeps?: boolean;
        run(context: ScreenshotActionRun): Promise<{ message?: string; dismiss?: boolean }>;
      }): () => void;
    };
  }
}
