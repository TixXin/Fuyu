#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PACKAGE = join(ROOT, "packages", "plugin-base");
const HOST_SOURCES = join(PACKAGE, "src", "host");
export const DEFAULT_OUT = join(ROOT, "src-tauri", "target", "plugins-v3", "host");

const ENTRIES = [
  { out: "main", in: "./src/host/main.mjs" },
  { out: "index", in: "./src/index.mjs" },
  { out: "include", in: "@cordisjs/include" },
  { out: "hmr", in: "@cordisjs/hmr" },
];

const REWRITES = [
  [/import\.meta\.resolve\("@cordisjs\/include"\)/g, 'new URL("./include.mjs", import.meta.url).href'],
  [/import\.meta\.resolve\("@cordisjs\/hmr"\)/g, 'new URL("./hmr.mjs", import.meta.url).href'],
  [/new URL\("\.\.\/index\.mjs", import\.meta\.url\)/g, 'new URL("./index.mjs", import.meta.url)'],
];

const BANNER = "import { createRequire as __fuyuCreateRequire } from 'node:module'; const require = __fuyuCreateRequire(import.meta.url);";
const BARE_RESOLVE = /import\.meta\.resolve\(\s*["'][^."'/][^"']*["']/;
const RELATIVE_URL = /new URL\(\s*["'](\.{1,2}\/[^"']*)["']\s*,\s*import\.meta\.url/g;

export function loadEsbuild() {
  const viaVite = createRequire(createRequire(join(ROOT, "package.json")).resolve("vite"));
  return viaVite("esbuild");
}

const rewriteHostUrls = {
  name: "fuyu-host-urls",
  setup(build) {
    build.onLoad({ filter: /\.mjs$/ }, (args) => {
      if (relative(HOST_SOURCES, args.path).startsWith("..")) return undefined;
      let contents = readFileSync(args.path, "utf8");
      for (const [pattern, replacement] of REWRITES) contents = contents.replace(pattern, replacement);
      return { contents, loader: "js" };
    });
  },
};

export async function bundleHost({ outDir = DEFAULT_OUT, minify = false } = {}) {
  const esbuild = loadEsbuild();
  rmSync(outDir, { recursive: true, force: true });
  const result = await esbuild.build({
    absWorkingDir: PACKAGE,
    entryPoints: ENTRIES,
    outdir: outDir,
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "node",
    target: "node22.15",
    outExtension: { ".js": ".mjs" },
    chunkNames: "chunk-[hash]",
    banner: { js: BANNER },
    external: ["bufferutil", "utf-8-validate"],
    plugins: [rewriteHostUrls],
    legalComments: "none",
    minify,
    metafile: true,
    logLevel: "warning",
  });
  const files = readdirSync(outDir).sort();
  for (const name of files) {
    const text = readFileSync(join(outDir, name), "utf8");
    const missing = [...text.matchAll(RELATIVE_URL)].map((match) => match[1]).filter((target) => !existsSync(join(outDir, target)));
    const bare = BARE_RESOLVE.exec(text)?.[0];
    if (bare || missing.length) {
      throw new Error(`${name} looks for ${bare ?? missing.join(", ")} at run time, which is not in the bundle; add it to ENTRIES and REWRITES in scripts/plugins-v3/bundle-host.mjs`);
    }
  }
  const bytes = files.reduce((sum, name) => sum + statSync(join(outDir, name)).size, 0);
  return { outDir, main: join(outDir, "main.mjs"), files, bytes, inputs: Object.keys(result.metafile.inputs).length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { out: { type: "string" }, minify: { type: "boolean", default: false } } });
  const built = await bundleHost({ outDir: values.out ? resolve(values.out) : DEFAULT_OUT, minify: values.minify });
  console.log(`plugin host: ${built.files.length} files, ${(built.bytes / 1024).toFixed(0)} KB from ${built.inputs} sources in ${relative(process.cwd(), built.outDir) || "."}`);
}
