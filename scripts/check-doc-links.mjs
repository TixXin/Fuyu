import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const IGNORED_PREFIXES = ["docs/tasks/0-archive/", "docs/releases/", "vendor/"];
const LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;

function trackedMarkdownFiles() {
  const out = execFileSync("git", ["ls-files", "*.md"], { cwd: ROOT, encoding: "utf8" });
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((file) => file && !IGNORED_PREFIXES.some((prefix) => file.startsWith(prefix)));
}

function stripCode(markdown) {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  return lines.map((line) => {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return "";
    }
    if (inFence) return "";
    return line.replace(/`[^`]*`/g, "");
  });
}

function extractTarget(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end > 1 ? trimmed.slice(1, end).trim() : "";
  }
  const space = trimmed.search(/\s/);
  return space === -1 ? trimmed : trimmed.slice(0, space);
}

function isExternal(target) {
  return (
    target.startsWith("#") ||
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) ||
    target.startsWith("//")
  );
}

function checkFile(file) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return [];
  const dir = path.posix.dirname(file);
  const lines = stripCode(fs.readFileSync(abs, "utf8"));
  const broken = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (const match of lines[i].matchAll(LINK_RE)) {
      const target = extractTarget(match[1]);
      if (!target || isExternal(target)) continue;
      const withoutQuery = target.split("#")[0].split("?")[0];
      if (!withoutQuery) continue;
      let decoded = withoutQuery;
      try {
        decoded = decodeURIComponent(withoutQuery);
      } catch {
        decoded = withoutQuery;
      }
      const rel = decoded.startsWith("/")
        ? decoded.slice(1)
        : path.posix.normalize(path.posix.join(dir, decoded));
      if (rel.startsWith("..")) continue;
      const targetAbs = path.join(ROOT, rel);
      if (!fs.existsSync(targetAbs)) {
        broken.push({ file, line: i + 1, target, resolved: rel });
      }
    }
  }
  return broken;
}

const files = trackedMarkdownFiles();
const broken = files.flatMap(checkFile);
if (broken.length > 0) {
  for (const item of broken) {
    console.error(`${item.file}:${item.line}: broken link ${item.target} (resolved: ${item.resolved})`);
  }
  console.error(`[check:doc-links] ${broken.length} broken link(s) across ${files.length} markdown file(s).`);
  process.exit(1);
}
console.log(`[check:doc-links] ${files.length} markdown file(s); 0 broken links.`);
