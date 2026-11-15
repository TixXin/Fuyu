import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { validateManifest } from "@fuyu/plugin-manifest";
import { bundleClient, bundleHost } from "./bundle.mjs";
import { compareDeclarations } from "./declarations.mjs";
import { planEntries } from "./entries.mjs";
import { BuildError } from "./errors.mjs";
import { selectFiles } from "./files.mjs";
import { APP_MODULES, DEFAULT_SHARED_MODULES, HOST_EXTERNALS } from "./shared.mjs";

export const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
export const DEFAULT_OUT_DIR = join("build", "package");
export const BUILD_ONLY_FIELDS = [
  "scripts", "dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta",
  "bundleDependencies", "bundledDependencies", "overrides", "workspaces", "packageManager", "devEngines",
];

export function resolveBuildOptions(options = {}) {
  const depth = options.packageDepth;
  if (depth !== undefined && depth !== null && !(Number.isInteger(depth) && depth >= 0)) throw new BuildError(`packageDepth must be a whole number of folders, got ${JSON.stringify(depth)}`);
  return {
    appKey: options.appKey ?? "fuyu",
    official: options.official ?? false,
    allowExperimental: options.allowExperimental ?? true,
    shared: options.shared ?? DEFAULT_SHARED_MODULES,
    hostExternal: options.hostExternal ?? HOST_EXTERNALS,
    appModules: options.appModules ?? APP_MODULES,
    packageDepth: options.packageDepth ?? null,
    nodeTarget: options.nodeTarget ?? "node22",
    browserTarget: options.browserTarget ?? "es2022",
  };
}

export function realPath(path) {
  if (existsSync(path)) return realpathSync(path);
  const parent = dirname(path);
  return parent === path ? path : join(realPath(parent), basename(path));
}

export function readManifest(dir) {
  const file = join(dir, "package.json");
  if (!existsSync(file)) throw new BuildError(`no package.json in ${dir}`, [{ path: "package.json", code: "missing", message: "missing" }]);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new BuildError(`package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, [{ path: "package.json", code: "json", message: "invalid JSON" }]);
  }
}

export function builtManifest(pkg, appKey, nodeApis, builtWith = VERSION) {
  const built = structuredClone(pkg);
  for (const field of BUILD_ONLY_FIELDS) delete built[field];
  built[appKey] = { ...built[appKey], nodeApis, builtWith };
  return built;
}

function prepareOutDir(root, outDir, appKey) {
  const back = relative(outDir, root);
  if (back === "" || (!back.startsWith("..") && !isAbsolute(back))) throw new BuildError(`the output folder ${outDir} must not contain the plugin folder`);
  if (!existsSync(outDir) || readdirSync(outDir).length === 0) return;
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(join(outDir, "package.json"), "utf8"));
  } catch {
    previous = null;
  }
  if (typeof previous?.[appKey]?.builtWith !== "string") throw new BuildError(`refusing to empty ${outDir}: it is not an earlier build output`);
  rmSync(outDir, { recursive: true, force: true });
}

function write(outDir, path, data) {
  const file = join(outDir, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}

export async function build(dir, options = {}) {
  const opts = resolveBuildOptions(options);
  const root = realPath(resolve(dir));
  const outDir = realPath(resolve(root, options.outDir ?? DEFAULT_OUT_DIR));
  const pkg = readManifest(root);
  const source = validateManifest(pkg, { appKey: opts.appKey, official: opts.official, allowExperimental: opts.allowExperimental, stage: "source" });
  if (!source.ok) throw new BuildError("package.json has errors", source.errors);
  const app = pkg[opts.appKey];
  const warnings = source.warnings.filter((issue) => issue.code !== "generated").map((issue) => ({ ...issue }));
  const plan = planEntries(root, app, opts.appKey);
  const outputs = new Map();
  let host = null;
  let nodeApis = [];
  if (plan.host) {
    const result = await bundleHost({ dir: root, entry: plan.host.source, output: plan.host.output, external: opts.hostExternal, target: opts.nodeTarget });
    outputs.set(plan.host.output, result.code);
    warnings.push(...result.warnings);
    host = { file: plan.host.output, text: result.code };
    nodeApis = result.nodeApis;
  }
  const clients = [];
  for (const client of plan.clients) {
    const result = await bundleClient({
      dir: root,
      entry: client.source,
      output: client.output,
      plugin: pkg.name,
      shared: opts.shared,
      packageDepth: opts.packageDepth,
      appModules: opts.appModules,
      target: opts.browserTarget,
    });
    outputs.set(client.output, result.code);
    warnings.push(...result.warnings);
    clients.push({ file: client.output, text: result.code });
  }
  if (plan.config) outputs.set(plan.config.output, readFileSync(join(root, plan.config.source)));
  const files = selectFiles(root, app, pkg.files, { exclude: [outDir], warn: (issue) => warnings.push(issue) });
  warnings.push(...compareDeclarations({ app, appKey: opts.appKey, host, clients, nodeApis, sourceNodeApis: app.nodeApis }));

  const manifest = builtManifest(pkg, opts.appKey, nodeApis);
  const built = validateManifest(manifest, { appKey: opts.appKey, official: opts.official, allowExperimental: opts.allowExperimental, stage: "built" });
  if (!built.ok) throw new BuildError("the built package.json has errors", built.errors);

  prepareOutDir(root, outDir, opts.appKey);
  mkdirSync(outDir, { recursive: true });
  write(outDir, "package.json", `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [path, data] of outputs) write(outDir, path, data);
  for (const path of files) {
    mkdirSync(dirname(join(outDir, path)), { recursive: true });
    copyFileSync(join(root, path), join(outDir, path));
  }
  const all = ["package.json", ...outputs.keys(), ...files].sort();
  return { dir: root, outDir, manifest, nodeApis, files: all, warnings };
}
