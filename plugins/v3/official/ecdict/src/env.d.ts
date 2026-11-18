interface ImportMeta {
  readonly url: string;
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare module "node:url" {
  export function fileURLToPath(url: string): string;
}

declare module "cordis" {
  interface Context {
    readonly translatorEngines: {
      register(spec: {
        engine: string;
        label?: { "zh-CN": string; en: string };
        defaultModel?: string;
        hasSecret?: boolean | (() => boolean | Promise<boolean>);
        translate(params: {
          text: string;
          direction: "auto" | "zh-en" | "en-zh";
          model: string | null;
        }): Promise<{ text: string } | string> | { text: string } | string;
      }): () => void;
    };
  }
}
