import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { readPackage, sha256Hex, validateManifest } from "@fuyu/plugin-manifest";
import { revocationOf } from "@fuyu/plugin-market";
import { discardStaged, recoverStaging, swapStaged, writeStaged } from "./staging.mjs";

export const PACKAGES_SUBDIR = "packages";

function installerError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}

const PACKAGE_ID = /^@([a-z0-9-]+)\/([a-z0-9._-]+)$/i;
const ONLY_DOTS = /^\.+$/;

function parsePackageId(id) {
  const match = typeof id === "string" ? PACKAGE_ID.exec(id) : null;
  if (!match || ONLY_DOTS.test(match[1]) || ONLY_DOTS.test(match[2])) return null;
  return { scope: match[1], name: match[2] };
}

export function isPackageId(id) {
  return parsePackageId(id) !== null;
}

function packageDirFor(basePackagesDir, id) {
  const parsed = parsePackageId(id);
  if (!parsed) throw installerError("bad-name", `${String(id)} is not a scoped plugin package name`);
  return join(basePackagesDir, `@${parsed.scope.toLowerCase()}`, parsed.name);
}

function stripEntryBlock(lines, id) {
  const result = [];
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^-\\s+id:\\s*(?:${escaped}|"${escaped}"|'${escaped}')\\s*$`);
  let skipping = false;
  for (const line of lines) {
    if (line.startsWith("- ")) skipping = pattern.test(line.trim());
    if (!skipping) result.push(line);
  }
  return result;
}

export function writeInstalledToYml(ymlFile, { id, source, disabled = false, replaces = [] }) {
  mkdirSync(dirname(ymlFile), { recursive: true });
  const raw = existsSync(ymlFile) ? readFileSync(ymlFile, "utf8").replace(/\r\n/g, "\n") : "";
  const trimmed = raw.trim();
  const baseLines = !trimmed || trimmed === "[]"
    ? []
    : stripEntryBlock(raw.split("\n"), id).filter((line, idx, arr) => !(idx === arr.length - 1 && line === ""));
  const entry = [
    `- id: ${JSON.stringify(id)}`,
    `  source: ${source}`,
  ];
  if (disabled) entry.push(`  disabled: true`);
  if (Array.isArray(replaces) && replaces.length > 0) {
    entry.push(`  replaces:`);
    for (const svc of replaces) entry.push(`    - ${JSON.stringify(svc)}`);
  }
  writeFileSync(ymlFile, `${[...baseLines, ...entry].join("\n")}\n`, "utf8");
}

export function removeInstalledFromYml(ymlFile, id) {
  if (!existsSync(ymlFile)) return false;
  const raw = readFileSync(ymlFile, "utf8").replace(/\r\n/g, "\n");
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "[]") return false;
  const kept = stripEntryBlock(raw.split("\n"), id).filter((line, idx, arr) => !(idx === arr.length - 1 && line === ""));
  writeFileSync(ymlFile, kept.length > 0 ? `${kept.join("\n")}\n` : "[]\n", "utf8");
  return true;
}

export function inspectPackage(zipBuffer, options = {}) {
  const source = options.source === "manual" ? "manual" : "market";
  if (source === "manual" && options.allowManual !== true) {
    throw installerError("manual-disabled", "Manual .fuyu package installation is turned off.");
  }
  const buf = typeof zipBuffer === "string" ? readFileSync(zipBuffer) : Buffer.isBuffer(zipBuffer) ? zipBuffer : Buffer.from(zipBuffer);
  const sha256 = sha256Hex(buf);
  if (typeof options.expectedSha256 === "string" && options.expectedSha256.toLowerCase() !== sha256.toLowerCase()) {
    throw installerError("bad-sha256", `Package SHA-256 mismatch: expected ${options.expectedSha256}, got ${sha256}`);
  }
  const pkg = readPackage(buf);
  if (typeof options.expectedName === "string" && pkg.manifest?.name !== options.expectedName) {
    throw installerError("name-mismatch", `Package is named ${String(pkg.manifest?.name)}, expected ${options.expectedName}`);
  }
  if (typeof options.expectedVersion === "string" && pkg.manifest?.version !== options.expectedVersion) {
    throw installerError("version-mismatch", `Package version is ${String(pkg.manifest?.version)}, expected ${options.expectedVersion}`);
  }
  const check = validateManifest(pkg.manifest, {
    stage: "built",
    allowExperimental: false,
    appVersion: options.appVersion,
    official: options.official === true,
  });
  if (!check.ok) {
    throw installerError(
      "bad-manifest",
      `Package manifest failed validation: ${check.errors.map((e) => e.message).join("; ")}`,
      { errors: check.errors },
    );
  }
  const fuyu = pkg.manifest.fuyu ?? {};
  return {
    id: pkg.manifest.name,
    version: pkg.manifest.version,
    source,
    digest: pkg.digest,
    sha256,
    manifest: pkg.manifest,
    files: pkg.files,
    confirmation: {
      unreviewed: source === "manual",
      displayName: fuyu.displayName,
      description: fuyu.description,
      nodeApis: Array.isArray(fuyu.nodeApis) ? fuyu.nodeApis : [],
      provides: Array.isArray(fuyu.provides) ? fuyu.provides : [],
      replaces: Array.isArray(fuyu.replaces) ? fuyu.replaces : [],
      slots: Array.isArray(fuyu.slots) ? fuyu.slots : [],
    },
  };
}

export function stagePackage(zipBuffer, options = {}) {
  if (typeof options.dir !== "string" || !options.dir) {
    throw installerError("bad-params", "stagePackage requires options.dir (the plugins-v3 data directory)");
  }
  const inspected = inspectPackage(zipBuffer, options);
  if (options.revocations) {
    const rev = revocationOf(options.revocations, inspected.id, inspected.version);
    if (rev?.level === "disable") {
      throw installerError("revoked", `${inspected.id}@${inspected.version} has been revoked and cannot be installed`, { entries: rev.entries });
    }
  }
  const packagesRoot = join(options.dir, PACKAGES_SUBDIR);
  const target = packageDirFor(packagesRoot, inspected.id);
  recoverStaging(packagesRoot, (id) => packageDirFor(packagesRoot, id));
  const dir = writeStaged(packagesRoot, inspected.files);
  return {
    id: inspected.id,
    version: inspected.version,
    source: inspected.source,
    digest: inspected.digest,
    sha256: inspected.sha256,
    confirmation: inspected.confirmation,
    disabled: options.disabled === true,
    target,
    dir,
  };
}

export { discardStaged };

export function commitStaged(dir, staged, { configFile = "plugins.yml" } = {}) {
  const list = Array.isArray(staged) ? staged : [staged];
  const ymlFile = join(dir, configFile);
  swapStaged(join(dir, PACKAGES_SUBDIR), list, {
    configFile: ymlFile,
    writeConfig: (item) => writeInstalledToYml(ymlFile, {
      id: item.id,
      source: item.source,
      disabled: item.disabled,
      replaces: item.confirmation.replaces,
    }),
  });
  return list.map((item) => ({
    id: item.id,
    version: item.version,
    source: item.source,
    root: item.target,
    digest: item.digest,
    sha256: item.sha256,
    confirmation: item.confirmation,
  }));
}

export function installPackage(zipBuffer, options = {}) {
  if (typeof options.dir !== "string" || !options.dir) {
    throw installerError("bad-params", "installPackage requires options.dir (the plugins-v3 data directory)");
  }
  const staged = stagePackage(zipBuffer, options);
  return commitStaged(options.dir, [staged], { configFile: options.configFile })[0];
}

export function uninstallPackage(dir, id, { configFile = "plugins.yml", removeData = false } = {}) {
  const targetRoot = packageDirFor(join(dir, PACKAGES_SUBDIR), id);
  const dataTarget = packageDirFor(join(dir, "data"), id);
  rmSync(targetRoot, { recursive: true, force: true });
  removeInstalledFromYml(join(dir, configFile), id);
  if (removeData) rmSync(dataTarget, { recursive: true, force: true });
  return { id, removed: true };
}

function scanInstalledPackages(dir) {
  const packagesRoot = join(dir, PACKAGES_SUBDIR);
  if (!existsSync(packagesRoot)) return [];
  const list = [];
  for (const scopeEntry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!scopeEntry.isDirectory() || !scopeEntry.name.startsWith("@")) continue;
    const scopeDir = join(packagesRoot, scopeEntry.name);
    for (const pkgEntry of readdirSync(scopeDir, { withFileTypes: true })) {
      if (!pkgEntry.isDirectory()) continue;
      const pkgJson = join(scopeDir, pkgEntry.name, "package.json");
      if (!existsSync(pkgJson)) continue;
      try {
        const parsed = JSON.parse(readFileSync(pkgJson, "utf8"));
        if (typeof parsed.name === "string" && typeof parsed.version === "string") {
          list.push({ id: parsed.name, version: parsed.version, source: "market" });
        }
      } catch {
        continue;
      }
    }
  }
  return list;
}

export function applyRevocationsToDir(dir, revocations, { installed, configFile = "plugins.yml" } = {}) {
  const disabled = [];
  const warned = [];
  const ymlFile = join(dir, configFile);
  const items = installed ?? scanInstalledPackages(dir);
  for (const item of items) {
    if (!isPackageId(item?.id)) continue;
    const rev = revocationOf(revocations, item.id, item.version);
    if (!rev) continue;
    if (rev.level === "disable") {
      writeInstalledToYml(ymlFile, { id: item.id, source: item.source ?? "market", disabled: true });
      disabled.push(item.id);
    } else if (rev.level === "warn") {
      warned.push({ id: item.id, version: item.version, reasons: rev.entries.map((e) => e.reason) });
    }
  }
  return { disabled, warned };
}
