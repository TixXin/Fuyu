#!/usr/bin/env node
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const HOST_SOURCES = join(ROOT, "packages", "plugin-base", "src", "host");
export const DEFAULT_OUT_DIR = join(ROOT, "node_modules", ".cache", "npm-sdk");
export const DEFAULT_VERSION = "2.0.0";

const BANNER = "import { createRequire as __fuyuCreateRequire } from 'node:module'; const require = __fuyuCreateRequire(import.meta.url);";
const BARE_RESOLVE = /import\.meta\.resolve\(\s*["'][^."'/][^"']*["']/;
const RELATIVE_URL = /new URL\(\s*["'](\.{1,2}\/[^"']*)["']\s*,\s*import\.meta\.url/g;

const HOST_URL_REWRITES = [
  [/import\.meta\.resolve\("@cordisjs\/hmr"\)/g, 'new URL("./hmr.mjs", import.meta.url).href'],
  [/new URL\("\.\.\/index\.mjs", import\.meta\.url\)/g, 'new URL("./index.mjs", import.meta.url)'],
  [/new URL\("\.\.\/services\.mjs", import\.meta\.url\)/g, 'new URL("./services.mjs", import.meta.url)'],
];

const WORKSPACE_ENTRIES = {
  "@fuyu/plugin-base": "packages/plugin-base/src/index.mjs",
  "@fuyu/plugin-base/services": "packages/plugin-base/src/services.mjs",
  "@fuyu/plugin-base/protocol": "packages/plugin-base/src/protocol.mjs",
  "@fuyu/plugin-base/host": "packages/plugin-base/src/host/index.mjs",
  "@fuyu/plugin-services": "packages/plugin-services/src/index.mjs",
  "@fuyu/plugin-cli": "packages/plugin-cli/src/index.mjs",
  "@fuyu/plugin-manifest": "packages/plugin-manifest/src/index.mjs",
  "@fuyu/plugin-manifest/names": "packages/plugin-manifest/src/names.mjs",
  "@fuyu/plugin-market": "packages/plugin-market/src/index.mjs",
  "@fuyu/plugin-review": "packages/plugin-review/src/index.mjs",
};

const TYPE_PACKAGE_TARGETS = {
  cordis: "internal/cordis/index.mjs",
  "@fuyu/plugin-manifest": "internal/plugin-manifest/index.mjs",
  "@fuyu/plugin-manifest/names": "internal/plugin-manifest/names.mjs",
  "@fuyu/plugin-market": "internal/plugin-market/index.mjs",
  "@fuyu/plugin-review": "internal/plugin-review/index.mjs",
  "@fuyu/plugin-base/services": "internal/plugin-base/services.mjs",
};

const MIT_LICENSE = `MIT License

Copyright (c) 2026 TixXin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const COSMOKIT_TYPES = `export type Dict<T = any, K extends keyof any = string> = { [P in K]: T };
export type Awaitable<T> = T | PromiseLike<T>;
export type Promisify<T> = Promise<Awaited<T>>;
`;

const STANDARD_SCHEMA_TYPES = `export declare namespace StandardSchemaV1 {
  interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined;
  }
}
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => unknown;
    readonly types?: { readonly input: Input; readonly output: Output } | undefined;
  };
}
`;

const FUYU_PLUGIN_README = `# fuyu-plugin

SDK, CLI (\`build\`, \`check\`, \`pack\`, \`dev\`, \`review\`, \`keygen\`, \`sign\`) and test host for [Fuyu](https://github.com/TixXin/fuyu) plugins.

## Quick start

\`\`\`sh
npm create fuyu-plugin@latest my-plugin -- --owner <github-user> --name my-plugin
cd my-plugin
npm install
npx fuyu-plugin check
npx fuyu-plugin pack
\`\`\`

## Imports

- \`fuyu-plugin\`: \`Context\`, \`Service\`, \`defineService\`, \`isServiceDefinition\`, and programmatic CLI APIs (\`build\`, \`check\`, \`pack\`, \`dev\`, \`reviewSources\`, \`signCommitAt\`)
- \`fuyu-plugin/services\`: built-in service definitions and types (\`timersV1\`, \`todosV1\`, \`commandsV1\`, \`pluginConfigV1\`, \`marketV1\`, ...)
- \`fuyu-plugin/protocol\`: slot definitions, theme variables and protocol constants
- \`fuyu-plugin/host\`: \`startHost\` for integration testing plugins in Node.js

Documentation: <https://github.com/TixXin/fuyu/tree/main/docs/plugins>
`;

const CREATE_FUYU_PLUGIN_README = `# create-fuyu-plugin

Scaffolds a TypeScript + React plugin project for [Fuyu](https://github.com/TixXin/fuyu).

\`\`\`sh
npm create fuyu-plugin@latest my-plugin -- --owner <github-user> --name my-plugin
cd my-plugin
npm install
npm run typecheck && npm run lint && npm run check
\`\`\`

Documentation: <https://github.com/TixXin/fuyu/tree/main/docs/plugins>
`;

function loadEsbuild() {
  const req = createRequire(join(ROOT, "packages", "plugin-cli", "package.json"));
  return req("esbuild");
}

function writeText(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function toPosix(path) {
  return path.split(sep).join("/");
}

function relativeImport(fromFile, toFile) {
  const rel = posix.relative(toPosix(dirname(fromFile)), toPosix(toFile));
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function workspacePlugin() {
  const baseReq = createRequire(join(ROOT, "packages", "plugin-base", "package.json"));
  return {
    name: "fuyu-workspace-resolve",
    setup(build) {
      build.onResolve({ filter: /^virtual:fuyu-plugin-index$/ }, () => ({ path: "index", namespace: "fuyu-virtual-index" }));
      build.onLoad({ filter: /.*/, namespace: "fuyu-virtual-index" }, () => ({
        contents: 'export * from "@fuyu/plugin-base";\nexport * from "@fuyu/plugin-base/services";\nexport * from "@fuyu/plugin-cli";\n',
        resolveDir: join(ROOT, "packages", "plugin-cli", "src"),
        loader: "js",
      }));
      build.onResolve({ filter: /^@fuyu\// }, (args) => {
        const target = WORKSPACE_ENTRIES[args.path];
        if (target) return { path: join(ROOT, target) };
        return undefined;
      });
      build.onResolve({ filter: /^@cordisjs\/hmr$/ }, () => ({ path: baseReq.resolve("@cordisjs/hmr") }));
    },
  };
}

function rewriteHostUrlsPlugin() {
  return {
    name: "fuyu-host-urls",
    setup(build) {
      build.onLoad({ filter: /\.mjs$/ }, (args) => {
        if (relative(HOST_SOURCES, args.path).startsWith("..")) return undefined;
        let contents = readFileSync(args.path, "utf8");
        for (const [pattern, replacement] of HOST_URL_REWRITES) contents = contents.replace(pattern, replacement);
        return { contents, loader: "js" };
      });
    },
  };
}

function verifyRuntimeUrls(distDir) {
  for (const name of readdirSync(distDir)) {
    if (!name.endsWith(".mjs")) continue;
    const file = join(distDir, name);
    const text = readFileSync(file, "utf8");
    const missing = [...text.matchAll(RELATIVE_URL)].map((match) => match[1]).filter((target) => !existsSync(join(dirname(file), target)));
    const bare = BARE_RESOLVE.exec(text)?.[0];
    if (bare || missing.length) {
      throw new Error(`${name} references unresolved runtime module ${bare ?? missing.join(", ")}`);
    }
  }
}

function walkDts(dir, skipDirs = new Set()) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return skipDirs.has(entry.name) ? [] : walkDts(full, skipDirs);
    return /\.(d\.mts|d\.ts)$/.test(entry.name) ? [full] : [];
  });
}

function buildTypes(typesDir) {
  writeText(join(typesDir, "internal", "cosmokit.d.mts"), COSMOKIT_TYPES);
  writeText(join(typesDir, "internal", "standard-schema.d.mts"), STANDARD_SCHEMA_TYPES);

  const cordisLib = join(ROOT, "vendor", "cordis", "core", "lib");
  for (const srcFile of walkDts(cordisLib)) {
    const outName = relative(cordisLib, srcFile).replace(/\.d\.ts$/, ".d.mts");
    const dest = join(typesDir, "internal", "cordis", outName);
    const text = readFileSync(srcFile, "utf8")
      .replaceAll("'cosmokit'", `'${relativeImport(dest, join(typesDir, "internal", "cosmokit.mjs"))}'`)
      .replaceAll("'@standard-schema/spec'", `'${relativeImport(dest, join(typesDir, "internal", "standard-schema.mjs"))}'`)
      .replace(/(['"])(\.\.?\/[^'"]+)\.ts\1/g, "$1$2.mjs$1");
    writeText(dest, text);
  }

  const packages = ["plugin-manifest", "plugin-market", "plugin-review", "plugin-base", "plugin-services", "plugin-cli"];
  for (const pkg of packages) {
    const srcRoot = join(ROOT, "packages", pkg, "src");
    const skip = pkg === "plugin-base" ? new Set(["client"]) : new Set();
    for (const srcFile of walkDts(srcRoot, skip)) {
      const rel = relative(srcRoot, srcFile);
      const dest = join(typesDir, "internal", pkg, rel);
      let text = readFileSync(srcFile, "utf8");
      if (pkg === "plugin-base" && rel === "index.d.mts") {
        const cordisContext = relativeImport(dest, join(typesDir, "internal", "cordis", "context.mjs"));
        text = text
          .replace('export type * from "./services.mjs";', 'export * from "./services.mjs";')
          .replace('declare module "cordis"', `declare module "${cordisContext}"`);
      }
      for (const [specifier, targetRel] of Object.entries(TYPE_PACKAGE_TARGETS)) {
        const replacement = relativeImport(dest, join(typesDir, targetRel));
        text = text.replaceAll(`"${specifier}"`, `"${replacement}"`).replaceAll(`'${specifier}'`, `'${replacement}'`);
      }
      writeText(dest, text);
    }
  }

  writeText(join(typesDir, "index.d.mts"), 'export * from "./internal/plugin-base/index.mjs";\nexport * from "./internal/plugin-cli/index.mjs";\n');
  writeText(join(typesDir, "services.d.mts"), 'export * from "./internal/plugin-services/index.mjs";\n');
  writeText(join(typesDir, "protocol.d.mts"), 'export * from "./internal/plugin-base/protocol.mjs";\n');
  writeText(join(typesDir, "host.d.mts"), 'import "./index.mjs";\nexport * from "./internal/plugin-base/host/index.mjs";\n');

  for (const file of walkDts(typesDir)) {
    const text = readFileSync(file, "utf8");
    const leak = /(?:from|module)\s+["'](@fuyu\/[^"']+|cordis|cosmokit|@standard-schema\/spec)["']/.exec(text);
    if (leak) throw new Error(`Unresolved internal type specifier ${leak[1]} in ${relative(typesDir, file)}`);
  }
}

function fuyuPluginManifest(version) {
  return {
    name: "fuyu-plugin",
    version,
    description: "SDK, CLI (build, check, pack, dev, sign) and test host for Fuyu plugins",
    keywords: ["fuyu", "plugin", "sdk"],
    license: "MIT",
    type: "module",
    repository: { type: "git", url: "git+https://github.com/TixXin/fuyu.git", directory: "packages/plugin-cli" },
    homepage: "https://github.com/TixXin/fuyu/tree/main/docs/plugins",
    engines: { node: ">=22.15" },
    bin: { "fuyu-plugin": "bin/fuyu-plugin.mjs" },
    exports: {
      ".": { types: "./types/index.d.mts", default: "./dist/index.mjs" },
      "./services": { types: "./types/services.d.mts", default: "./dist/services.mjs" },
      "./protocol": { types: "./types/protocol.d.mts", default: "./dist/protocol.mjs" },
      "./host": { types: "./types/host.d.mts", default: "./dist/host.mjs" },
      "./package.json": "./package.json",
    },
    files: ["bin", "dist", "types", "README.md", "LICENSE"],
    dependencies: { esbuild: "0.28.1", ws: "^8.18.0" },
  };
}

function createFuyuPluginManifest(version) {
  return {
    name: "create-fuyu-plugin",
    version,
    description: "Creates a Fuyu plugin project: npm create fuyu-plugin@latest",
    keywords: ["fuyu", "plugin", "create"],
    license: "MIT",
    type: "module",
    repository: { type: "git", url: "git+https://github.com/TixXin/fuyu.git", directory: "packages/create-plugin" },
    homepage: "https://github.com/TixXin/fuyu/tree/main/docs/plugins",
    engines: { node: ">=22.15" },
    bin: { "create-fuyu-plugin": "bin/create-fuyu-plugin.mjs" },
    exports: { ".": { default: "./dist/index.mjs" }, "./package.json": "./package.json" },
    files: ["bin", "dist", "template", "README.md", "LICENSE"],
  };
}

export async function packNpmSdk({ outDir = DEFAULT_OUT_DIR, version = DEFAULT_VERSION } = {}) {
  const esbuild = loadEsbuild();
  const rootOut = resolve(outDir);
  const fuyuDir = join(rootOut, "fuyu-plugin");
  const createDir = join(rootOut, "create-fuyu-plugin");
  rmSync(fuyuDir, { recursive: true, force: true });
  rmSync(createDir, { recursive: true, force: true });

  writeText(join(fuyuDir, "package.json"), `${JSON.stringify(fuyuPluginManifest(version), null, 2)}\n`);
  writeText(join(fuyuDir, "LICENSE"), MIT_LICENSE);
  writeText(join(fuyuDir, "README.md"), FUYU_PLUGIN_README);

  const fuyuBin = join(fuyuDir, "bin", "fuyu-plugin.mjs");
  writeText(
    fuyuBin,
    '#!/usr/bin/env node\nimport { run } from "../dist/index.mjs";\n\nrun(process.argv.slice(2)).then(\n  (code) => {\n    process.exitCode = code;\n  },\n  (error) => {\n    process.stderr.write(`error: ${error instanceof Error ? error.message : String(error)}\\n`);\n    process.exitCode = 1;\n  },\n);\n',
  );
  chmodSync(fuyuBin, 0o755);

  await esbuild.build({
    absWorkingDir: join(ROOT, "packages", "plugin-base"),
    entryPoints: [
      { out: "index", in: "virtual:fuyu-plugin-index" },
      { out: "protocol", in: "./src/protocol.mjs" },
      { out: "host", in: "./src/host/index.mjs" },
      { out: "host-main", in: "./src/host/main.mjs" },
      { out: "plugins-file", in: "./src/host/plugins-file.mjs" },
      { out: "client-only", in: "./src/host/client-only.mjs" },
      { out: "hmr", in: "@cordisjs/hmr" },
    ],
    outdir: join(fuyuDir, "dist"),
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "node",
    target: "node22.15",
    outExtension: { ".js": ".mjs" },
    chunkNames: "chunk-[hash]",
    banner: { js: BANNER },
    external: ["esbuild", "ws", "bufferutil", "utf-8-validate"],
    plugins: [workspacePlugin(), rewriteHostUrlsPlugin()],
    legalComments: "none",
    logLevel: "warning",
  });

  await esbuild.build({
    absWorkingDir: join(ROOT, "packages", "plugin-services"),
    entryPoints: [join(ROOT, "packages", "plugin-services", "src", "index.mjs")],
    outfile: join(fuyuDir, "dist", "services.mjs"),
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    plugins: [workspacePlugin()],
    legalComments: "none",
    logLevel: "warning",
  });

  verifyRuntimeUrls(join(fuyuDir, "dist"));
  buildTypes(join(fuyuDir, "types"));

  writeText(join(createDir, "package.json"), `${JSON.stringify(createFuyuPluginManifest(version), null, 2)}\n`);
  writeText(join(createDir, "LICENSE"), MIT_LICENSE);
  writeText(join(createDir, "README.md"), CREATE_FUYU_PLUGIN_README);
  cpSync(join(ROOT, "packages", "create-plugin", "template"), join(createDir, "template"), { recursive: true });

  const createBin = join(createDir, "bin", "create-fuyu-plugin.mjs");
  writeText(
    createBin,
    '#!/usr/bin/env node\nimport { main } from "../dist/index.mjs";\n\nmain().then(\n  (code) => {\n    process.exitCode = code;\n  },\n  (error) => {\n    console.error(`error: ${error?.message ?? error}`);\n    process.exitCode = 1;\n  },\n);\n',
  );
  chmodSync(createBin, 0o755);

  await esbuild.build({
    absWorkingDir: join(ROOT, "packages", "create-plugin"),
    entryPoints: [join(ROOT, "packages", "create-plugin", "src", "index.mjs")],
    outfile: join(createDir, "dist", "index.mjs"),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22.15",
    plugins: [workspacePlugin()],
    legalComments: "none",
    logLevel: "warning",
  });

  return { outDir: rootOut, version, fuyuDir, createDir };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      out: { type: "string" },
      version: { type: "string", default: DEFAULT_VERSION },
    },
  });
  const built = await packNpmSdk({
    outDir: values.out ? resolve(values.out) : DEFAULT_OUT_DIR,
    version: values.version,
  });
  console.log(`packed fuyu-plugin@${built.version} and create-fuyu-plugin@${built.version} in ${relative(process.cwd(), built.outDir) || "."}`);
}
