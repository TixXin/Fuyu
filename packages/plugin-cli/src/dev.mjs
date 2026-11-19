import { existsSync, mkdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { build, readManifest, realPath } from "./build.mjs";
import { SOURCE_DIR } from "./entries.mjs";
import { removeInstalledFromYml, stripEntryBlock } from "./installer.mjs";

export const DEV_DIR_ENV = "FUYU_PLUGINS_V3_DIR";

export function defaultDataDir(home = homedir()) {
  return join(home, ".fuyu", "plugins-v3");
}

function escapeYaml(text) {
  return JSON.stringify(String(text));
}

export function registerDevEntry(ymlFile, id, devOutDir) {
  mkdirSync(dirname(ymlFile), { recursive: true });
  const raw = existsSync(ymlFile) ? readFileSync(ymlFile, "utf8").replace(/\r\n/g, "\n") : "";
  const trimmed = raw.trim();
  const baseLines = !trimmed || trimmed === "[]"
    ? []
    : stripEntryBlock(raw.split("\n"), id).filter((line, idx, arr) => !(idx === arr.length - 1 && line === ""));
  const entryLines = [
    `- id: ${escapeYaml(id)}`,
    `  source: dev`,
    `  path: ${escapeYaml(devOutDir)}`,
  ];
  const next = [...baseLines, ...entryLines].join("\n") + "\n";
  writeFileSync(ymlFile, next, "utf8");
  return ymlFile;
}

export function unregisterDevEntry(ymlFile, id) {
  return removeInstalledFromYml(ymlFile, id);
}

export async function dev(dir, options = {}) {
  const root = realPath(resolve(dir));
  const dataDir = resolve(options.dataDir ?? process.env[DEV_DIR_ENV] ?? defaultDataDir());
  const ymlFile = join(dataDir, options.configFile ?? "plugins.yml");

  if (options.cleanOnly) {
    const pkg = readManifest(root);
    const id = String(pkg.name ?? "");
    unregisterDevEntry(ymlFile, id);
    return { id, ymlFile, cleaned: true, result: null, close: async () => {} };
  }

  const buildOpts = {
    ...options,
    allowExperimental: true,
    outDir: options.outDir,
  };
  let latest = await build(root, buildOpts);
  registerDevEntry(ymlFile, latest.manifest.name, latest.outDir);

  if (options.once) {
    return {
      id: latest.manifest.name,
      ymlFile,
      cleaned: false,
      result: latest,
      rebuild: async () => {
        latest = await build(root, buildOpts);
        return latest;
      },
      close: async ({ clean = false } = {}) => {
        if (clean) unregisterDevEntry(ymlFile, latest.manifest.name);
      },
    };
  }

  const watchers = [];
  let timer = null;
  let closed = false;
  const debounceMs = typeof options.debounceMs === "number" ? options.debounceMs : 120;

  const triggerRebuild = () => {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (closed) return;
      try {
        latest = await build(root, buildOpts);
        options.onRebuild?.(latest);
      } catch (error) {
        options.onError?.(error);
      }
    }, debounceMs);
  };

  const srcDir = join(root, SOURCE_DIR);
  if (existsSync(srcDir)) {
    try {
      watchers.push(watch(srcDir, { recursive: true }, () => triggerRebuild()));
    } catch {
      watchers.push(watch(srcDir, () => triggerRebuild()));
    }
  }
  const pkgFile = join(root, "package.json");
  if (existsSync(pkgFile)) {
    watchers.push(watch(pkgFile, () => triggerRebuild()));
  }

  return {
    id: latest.manifest.name,
    ymlFile,
    cleaned: false,
    get result() {
      return latest;
    },
    rebuild: async () => {
      latest = await build(root, buildOpts);
      options.onRebuild?.(latest);
      return latest;
    },
    close: async ({ clean = false } = {}) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
      if (clean) unregisterDevEntry(ymlFile, latest.manifest.name);
    },
  };
}
