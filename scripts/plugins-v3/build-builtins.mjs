#!/usr/bin/env node
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { BUILTINS_FILE, readBuiltins } from "@fuyu/plugin-base/host";
import { BANNER, checkRuntimeFiles, loadEsbuild } from "./bundle-host.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const DEFAULT_SOURCE = join(ROOT, "src", "features");
export const DEFAULT_OUT = join(ROOT, "src-tauri", "target", "plugins-v3", "builtins");
export const SHARED = ["@fuyu/plugin-base", "fuyu-plugin"];
const RETRIES = 5;
const SOURCE_EXTENSION = /\.[cm]?[jt]s$/;

function swapIn(staged, outDir) {
  for (let attempt = 0; ; attempt += 1) {
    rmSync(outDir, { recursive: true, force: true });
    try {
      renameSync(staged, outDir);
      return;
    } catch (error) {
      if (attempt >= RETRIES || !["ENOTEMPTY", "EEXIST", "EPERM", "EBUSY"].includes(error?.code)) throw error;
    }
  }
}

function copyManifest(from, to) {
  const pkg = JSON.parse(readFileSync(join(from, "package.json"), "utf8"));
  if (pkg.fuyu?.host) pkg.fuyu.host = pkg.fuyu.host.replace(SOURCE_EXTENSION, ".mjs");
  mkdirSync(to, { recursive: true });
  writeFileSync(join(to, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);
}

export async function buildBuiltins({ source = DEFAULT_SOURCE, outDir = DEFAULT_OUT, minify = false } = {}) {
  const catalog = readBuiltins(source);
  const staged = `${outDir}.${process.pid}.tmp`;
  rmSync(staged, { recursive: true, force: true });
  mkdirSync(staged, { recursive: true });
  try {
    const windowed = catalog.plugins.filter((plugin) => plugin.clients.length > 0).map((plugin) => plugin.id);
    if (windowed.length) throw new Error(`built-in plugins with window code (fuyu.client) cannot be built yet: ${windowed.join(", ")}`);
    const entries = catalog.plugins.filter((plugin) => plugin.host).map((plugin) => {
      const file = fileURLToPath(plugin.host);
      return { in: file, out: relative(catalog.dir, file).replace(SOURCE_EXTENSION, "").split(sep).join("/") };
    });
    const result = await loadEsbuild().build({
      entryPoints: entries,
      outdir: staged,
      bundle: true,
      splitting: false,
      format: "esm",
      platform: "node",
      target: "node22.15",
      outExtension: { ".js": ".mjs" },
      banner: { js: BANNER },
      external: SHARED.flatMap((name) => [name, `${name}/*`]),
      legalComments: "none",
      minify,
      metafile: true,
      logLevel: "warning",
    });
    const files = entries.map((entry) => `${entry.out}.mjs`);
    checkRuntimeFiles(staged, files, "a built-in plugin's host part must be a single file; load what it needs with import instead");
    const list = JSON.parse(readFileSync(join(catalog.dir, BUILTINS_FILE), "utf8"));
    list.plugins = list.plugins.map((plugin) => (plugin.host === undefined ? plugin : { ...plugin, host: plugin.host.replace(SOURCE_EXTENSION, ".mjs") }));
    writeFileSync(join(staged, BUILTINS_FILE), `${JSON.stringify(list, null, 2)}\n`);
    for (const plugin of list.plugins.filter((item) => item.host === undefined)) copyManifest(join(catalog.dir, ...plugin.root.split("/")), join(staged, ...plugin.root.split("/")));
    mkdirSync(dirname(outDir), { recursive: true });
    swapIn(staged, outDir);
    const bytes = files.reduce((sum, name) => sum + statSync(join(outDir, name)).size, 0);
    return { outDir, plugins: catalog.plugins.map((plugin) => plugin.id), files, bytes, inputs: Object.keys(result.metafile.inputs).length };
  } finally {
    rmSync(staged, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { source: { type: "string" }, out: { type: "string" }, minify: { type: "boolean", default: false } } });
  const started = performance.now();
  const built = await buildBuiltins({ source: values.source ? resolve(values.source) : DEFAULT_SOURCE, outDir: values.out ? resolve(values.out) : DEFAULT_OUT, minify: values.minify });
  const ms = Math.round(performance.now() - started);
  console.log(`built-in plugins: ${built.plugins.join(", ") || "none"}, ${(built.bytes / 1024).toFixed(0)} KB from ${built.inputs} sources in ${relative(process.cwd(), built.outDir) || "."} (${ms} ms)`);
}
