import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brokenImports, compare, cordisFiles, exportFiles, fuyuNames } from "./transform.mjs";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const MAP_FILE = fileURLToPath(new URL("./map.json", import.meta.url));

const HELP = `Usage: node scripts/cordis/export.mjs <command> [options]

  check [--cordis <dir>]   Compare the export with a tauri-cordis checkout (default ../tauri-cordis); exit 1 when they differ
  write [--cordis <dir>]   Write the export into a tauri-cordis checkout, removing managed files Fuyu no longer has
  names                    List Fuyu names left in the export (test fixtures excepted); exit 1 when there are any
  imports                  List imports in the export that point at files not exported; exit 1 when there are any

Options:
  --cordis <dir>   tauri-cordis checkout
  --verbose        print every file, not just the counts
  --json           print the report as JSON`;

export function loadMap(file = MAP_FILE) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function list(title, items, verbose, format = (item) => item) {
  console.log(`${title}: ${items.length}`);
  for (const item of verbose ? items : items.slice(0, 20)) console.log(`  ${format(item)}`);
  if (!verbose && items.length > 20) console.log(`  … ${items.length - 20} more (--verbose)`);
}

export function writeExport(files, cordis, map) {
  for (const path of cordisFiles(cordis, map)) if (!files.has(path)) unlinkSync(join(cordis, path));
  for (const [path, bytes] of files) {
    mkdirSync(dirname(join(cordis, path)), { recursive: true });
    writeFileSync(join(cordis, path), bytes);
  }
}

export function main(args, { root = ROOT, map = loadMap() } = {}) {
  const [command] = args;
  const verbose = args.includes("--verbose");
  const json = args.includes("--json");
  const cordis = resolve(root, option(args, "--cordis") ?? map.cordisRepo);
  if (!["check", "write", "names", "imports"].includes(command)) {
    console.log(HELP);
    return command ? 2 : 0;
  }
  const files = exportFiles(root, map);
  if (command === "names") {
    const hits = fuyuNames(map, files);
    if (json) console.log(JSON.stringify(hits, null, 2));
    else list("Fuyu names in the export", hits, verbose, (hit) => `${hit.path}:${hit.line}  ${hit.text}`);
    return hits.length ? 1 : 0;
  }
  if (command === "imports") {
    const broken = brokenImports(files);
    if (json) console.log(JSON.stringify(broken, null, 2));
    else list("Imports of files that are not exported", broken, verbose, (item) => `${item.path} → ${item.specifier}`);
    return broken.length ? 1 : 0;
  }
  if (command === "write") {
    writeExport(files, cordis, map);
    console.log(`Wrote ${files.size} files into ${cordis}`);
    return 0;
  }
  const report = compare(files, cordis, map);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    list("Differ", report.differs, verbose);
    list("Only in Fuyu's export", report.missing, verbose);
    list("Only in tauri-cordis", report.extra, verbose);
  }
  return report.differs.length + report.missing.length + report.extra.length ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
