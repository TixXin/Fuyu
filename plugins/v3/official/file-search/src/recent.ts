import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { splitPath, type FileHit } from "./model.ts";

const IGNORED = new Set(["desktop.ini", ".ds_store", ".localized"]);
const isIgnored = (lower: string) => IGNORED.has(lower) || (lower.startsWith("thumbs.") && lower.endsWith("db"));
const COMMON_SUBDIRS = ["Desktop", "Downloads", "Documents"] as const;
const MAX_PER_DIR = 40;

export function commonFolders(home: string = homedir()): string[] {
  return COMMON_SUBDIRS.map((name) => join(home, name)).filter((dir) => existsSync(dir));
}

export function scanRecentFiles(
  platform: string = process.platform,
  home: string = homedir(),
  limit = 8,
): FileHit[] {
  const found: Array<{ hit: FileHit; mtimeMs: number }> = [];
  const seen = new Set<string>();

  for (const dir of commonFolders(home)) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    let count = 0;
    for (const entry of entries) {
      if (count >= MAX_PER_DIR) break;
      const lower = entry.name.toLowerCase();
      if (entry.name.startsWith(".") || isIgnored(lower)) continue;
      const full = join(dir, entry.name);
      if (seen.has(full)) continue;
      seen.add(full);
      try {
        const st = statSync(full);
        const { name, folder } = splitPath(full, platform);
        if (!name) continue;
        found.push({
          hit: { path: full, name, folder, isDir: entry.isDirectory() },
          mtimeMs: st.mtimeMs,
        });
        count += 1;
      } catch {
        continue;
      }
    }
  }

  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return found.slice(0, limit).map((item) => item.hit);
}
