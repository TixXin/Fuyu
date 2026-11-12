import { compareVersions } from "./channel.mjs";

export const VERSION_FILES = {
  package: "package.json",
  tauri: "src-tauri/tauri.conf.json",
  cargo: "src-tauri/Cargo.toml",
  cargoLock: "src-tauri/Cargo.lock",
};

const CRATE = "fuyu";
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const PATTERNS = {
  package: /("version"\s*:\s*")([^"]+)(")/,
  tauri: /("version"\s*:\s*")([^"]+)(")/,
  cargo: /^(version\s*=\s*")([^"]+)(")/m,
  cargoLock: new RegExp(`(\\[\\[package\\]\\]\\r?\\nname = "${CRATE}"\\r?\\nversion = ")([^"]+)(")`),
};

export function readVersion(kind, text) {
  return PATTERNS[kind].exec(text)?.[2] ?? null;
}

export function writeVersion(kind, text, version) {
  if (readVersion(kind, text) === null) throw new Error(`No version found in ${VERSION_FILES[kind]}.`);
  return text.replace(PATTERNS[kind], (_, before, _old, after) => `${before}${version}${after}`);
}

export function isVersion(version) {
  return SEMVER.test(version);
}

export function bumpProblem(version, tags) {
  if (!isVersion(version)) return `${version} is not a version like 0.3.4 or 0.3.4-beta.1.`;
  const released = tags.map((tag) => tag.replace(/^v/, "")).filter(isVersion);
  const newest = released.sort(compareVersions).at(-1);
  if (newest && compareVersions(version, newest) <= 0) return `${version} is not newer than the last release, v${newest}.`;
  return null;
}
