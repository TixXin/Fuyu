#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { dev, readManifest } from "../../packages/plugin-cli/src/index.mjs";
import { stripEntryBlock } from "../../packages/plugin-cli/src/installer.mjs";
import { devPluginsDir } from "./install-demo.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OFFICIAL_ROOT = join(REPO_ROOT, "plugins", "v3", "official");

function appDataRoot({ platform = process.platform, env = process.env, home = homedir() } = {}) {
  if (platform === "win32") return env.APPDATA ?? join(home, "AppData", "Roaming");
  if (platform === "darwin") return join(home, "Library", "Application Support");
  return env.XDG_DATA_HOME ?? join(home, ".local", "share");
}

export function resolvePluginDir(target, repoRoot = REPO_ROOT) {
  const cleaned = String(target ?? "").trim();
  if (!cleaned) throw new Error("missing plugin name or path (e.g. weather)");
  const slug = cleaned.startsWith("@fuyu/") ? cleaned.slice("@fuyu/".length) : cleaned;
  const officialCandidate = join(repoRoot, "plugins", "v3", "official", slug);
  if (existsSync(join(officialCandidate, "package.json"))) {
    return { dir: officialCandidate, slug, official: true };
  }
  const direct = resolve(cleaned);
  if (existsSync(join(direct, "package.json"))) {
    const manifest = readManifest(direct);
    const name = String(manifest.name ?? basename(direct));
    const derivedSlug = name.startsWith("@fuyu/") ? name.slice("@fuyu/".length) : basename(direct);
    return { dir: direct, slug: derivedSlug, official: name.startsWith("@fuyu/") };
  }
  throw new Error(`plugin not found: ${cleaned}`);
}

export function detectDevPluginsDir({ dir, lane, platform = process.platform, env = process.env, home = homedir() } = {}) {
  if (dir) return resolve(dir);
  if (env.FUYU_PLUGINS_V3_DIR) return resolve(env.FUYU_PLUGINS_V3_DIR);
  const explicitLane = lane ?? env.FUYU_DEV_LANE ?? env.FOCUSD_DEV_LANE;
  if (explicitLane) return devPluginsDir({ lane: explicitLane, platform, env, home });

  const base = appDataRoot({ platform, env, home });
  if (existsSync(base)) {
    const candidates = [];
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^com\.tixxin\.fuyu\.lane-\d+$/.test(entry.name)) continue;
      const pluginsDir = join(base, entry.name, "plugins-v3");
      const yml = join(pluginsDir, "plugins.yml");
      if (existsSync(yml)) {
        candidates.push({ pluginsDir, mtimeMs: statSync(yml).mtimeMs });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return candidates[0].pluginsDir;
    }
  }
  return devPluginsDir({ lane: "1", platform, env, home });
}

export function restoreMarketEntry(ymlFile, id) {
  mkdirSync(dirname(ymlFile), { recursive: true });
  const raw = existsSync(ymlFile) ? readFileSync(ymlFile, "utf8").replace(/\r\n/g, "\n") : "";
  const trimmed = raw.trim();
  const baseLines =
    !trimmed || trimmed === "[]"
      ? []
      : stripEntryBlock(raw.split("\n"), id).filter((line, idx, arr) => !(idx === arr.length - 1 && line === ""));
  const entryLines = [`- id: ${JSON.stringify(String(id))}`, "  source: market"];
  writeFileSync(ymlFile, `${[...baseLines, ...entryLines].join("\n")}\n`, "utf8");
  return ymlFile;
}

async function main(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      once: { type: "boolean", default: false },
      clean: { type: "boolean", default: false },
      market: { type: "boolean", default: false },
      lane: { type: "string" },
      dir: { type: "string" },
      out: { type: "string" },
    },
  });

  if (positionals.length === 0) {
    console.error("usage: pnpm plugin:dev <slug|dir> [--once|--clean|--market] [--lane <n>] [--dir <plugins-v3>] [--out <dir>]");
    process.exitCode = 2;
    return;
  }

  const target = resolvePluginDir(positionals[0], REPO_ROOT);
  const dataDir = detectDevPluginsDir({ dir: values.dir, lane: values.lane });
  const ymlFile = join(dataDir, "plugins.yml");

  if (values.market) {
    const manifest = readManifest(target.dir);
    const id = String(manifest.name ?? "");
    restoreMarketEntry(ymlFile, id);
    console.log(`[plugin:dev] restored ${id} to source: market in ${ymlFile}`);
    return;
  }

  if (values.clean) {
    const cleaned = await dev(target.dir, { dataDir, cleanOnly: true });
    console.log(`[plugin:dev] removed ${cleaned.id} from ${cleaned.ymlFile}`);
    return;
  }

  const outDir = values.out ? resolve(values.out) : join(tmpdir(), "fuyu-plugin-dev", target.slug);
  const session = await dev(target.dir, {
    official: target.official,
    dataDir,
    outDir,
    once: values.once,
    onRebuild: (res) => console.log(`[plugin:dev] rebuilt ${res.manifest.name} ${res.manifest.version} -> ${res.outDir}`),
    onError: (err) => console.error(`[plugin:dev] build error: ${err instanceof Error ? err.message : String(err)}`),
  });

  for (const warning of session.result.warnings) {
    console.warn(`[plugin:dev] warning: ${warning.message ?? warning}`);
  }
  console.log(
    `[plugin:dev] ${session.id} ${session.result.manifest.version} -> ${session.result.outDir} (${session.ymlFile})`,
  );

  if (values.once) return;

  console.log(`[plugin:dev] watching ${target.dir} for live reload (Ctrl+C to stop)`);
  const stop = async () => {
    await session.close({ clean: false });
    process.exit(0);
  };
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(OFFICIAL_ROOT)) {
    console.error(`[plugin:dev] missing ${OFFICIAL_ROOT}`);
    process.exitCode = 1;
  } else {
    void main(process.argv.slice(2)).catch((error) => {
      console.error(`[plugin:dev] ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
  }
}
