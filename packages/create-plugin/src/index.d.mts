export interface ScaffoldInput {
  owner?: string;
  name?: string;
  repository?: string;
  displayName?: string;
  displayNameZh?: string;
  fuyu?: string;
  dir?: string;
}

export interface ScaffoldOptions {
  owner: string;
  name: string;
  packageName: string;
  repository: string;
  displayName: { "zh-CN": string; en: string };
  description: { "zh-CN": string; en: string };
  css: string;
  checkout: string;
  dir: string;
}

export interface MainIo {
  cwd: string;
  interactive: boolean;
  log: (text: string) => void;
}

export declare const ENGINE: string;
export declare const TOOLS: Readonly<Record<string, string>>;
export declare const FUYU_PACKAGES: Readonly<Record<string, string>>;
export declare const OWN_CHECKOUT: string;
export declare const TEMPLATE_DIR: string;
export declare const SLOTS_USED: readonly string[];
export declare const SERVICES_USED: readonly string[];
export declare const EXPERIMENTAL: readonly string[];

export declare function main(argv?: string[], io?: MainIo): Promise<number>;
export declare function nameProblem(name: string): string | null;
export declare function ownerProblem(owner: string): string | null;
export declare function normalizeOptions(input?: ScaffoldInput): ScaffoldOptions;
export declare function fillTemplate(text: string, options: ScaffoldOptions): string;
export declare function projectFiles(options: ScaffoldOptions): Map<string, string>;
export declare function scaffold(input: ScaffoldInput): { options: ScaffoldOptions; written: string[] };
export declare function isCheckout(dir: string): boolean;
export declare function findCheckout(given?: string): string;
export declare function devDependencies(checkout: string): Record<string, string>;
