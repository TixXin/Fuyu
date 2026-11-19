import { resolve } from "node:path";
import { SERVICE_NAME, SLOTS } from "@fuyu/plugin-base/protocol";
import { review } from "@fuyu/plugin-review";
import { build, readManifest } from "./build.mjs";
import { BuildError } from "./errors.mjs";
import { lintListing } from "./lint.mjs";
import { createScratch, snapshotDirectory } from "./sources.mjs";

const KNOWN_SLOTS = Object.freeze(Object.keys(SLOTS));
const KNOWN_INJECT = Object.freeze([
  "clients",
  "commands",
  "config",
  "http",
  "island",
  "settings",
  "windows",
  "translator.engines",
  "lyrics.sources",
  "calendar.sources",
  "agents.sources",
  "clipboard.actions",
  "screenshot.actions",
  "messages.sources",
]);
const KNOWN_INJECT_SET = new Set(KNOWN_INJECT);

function isExperimental(finding) {
  return finding.check === "manifest" && finding.file === "package.json" && finding.message.includes("fuyu.experimental");
}

function fromFinding(finding) {
  return {
    code: `review:${finding.check}`,
    file: finding.file,
    line: finding.line,
    message: finding.detail ? `${finding.message}: ${finding.detail}` : finding.message,
  };
}

function safeReadManifest(dir) {
  try {
    return readManifest(dir);
  } catch {
    return null;
  }
}

function checkInterfaces(pkg, appKey, allowExperimental) {
  const app = pkg?.[appKey];
  if (!app || typeof app !== "object" || Array.isArray(app)) return [];
  const experimental = new Set(Array.isArray(app.experimental) ? app.experimental.filter((item) => typeof item === "string") : []);
  const issues = [];
  if (Array.isArray(app.slots)) {
    app.slots.forEach((slot, index) => {
      if (typeof slot !== "string" || slot.trim() === "") return;
      if (Object.hasOwn(SLOTS, slot)) {
        if (SLOTS[slot].experimental === true) {
          if (allowExperimental && (experimental.has(slot) || experimental.has("windows/v1"))) return;
          issues.push({
            path: `${appKey}.slots[${index}]`,
            code: "experimental",
            message: `"${slot}" is an experimental slot and requires ${appKey}.experimental to include "${slot}" or "windows/v1"`,
          });
        }
        return;
      }
      if (allowExperimental && experimental.has(slot)) return;
      issues.push({
        path: `${appKey}.slots[${index}]`,
        code: "unknown-slot",
        message: `"${slot}" is not a known slot (known slots: ${KNOWN_SLOTS.join(", ")})`,
      });
    });
  }
  for (const field of ["provides", "replaces"]) {
    const list = app[field];
    if (!Array.isArray(list)) continue;
    list.forEach((name, index) => {
      if (typeof name !== "string" || name.trim() === "") return;
      if (SERVICE_NAME.test(name)) return;
      issues.push({
        path: `${appKey}.${field}[${index}]`,
        code: "service-name",
        message: `"${name}" is not a valid service name (expected <name>/v<version>, e.g. "timers/v1")`,
      });
    });
  }
  if (app.inject && typeof app.inject === "object" && !Array.isArray(app.inject)) {
    for (const kind of ["required", "optional"]) {
      const list = app.inject[kind];
      if (!Array.isArray(list)) continue;
      list.forEach((name, index) => {
        if (typeof name !== "string" || name.trim() === "") return;
        if (name === "windows") {
          if (allowExperimental && (experimental.has("windows") || experimental.has("windows/v1"))) return;
          issues.push({
            path: `${appKey}.inject.${kind}[${index}]`,
            code: "experimental",
            message: `"windows" is experimental and requires ${appKey}.experimental to include "windows/v1"`,
          });
          return;
        }
        if (SERVICE_NAME.test(name) || KNOWN_INJECT_SET.has(name)) return;
        if (allowExperimental && experimental.has(name)) return;
        issues.push({
          path: `${appKey}.inject.${kind}[${index}]`,
          code: "service-name",
          message: `"${name}" is not a valid service name (expected <name>/v<version> such as "timers/v1", or one of ${KNOWN_INJECT.join(", ")})`,
        });
      });
    }
  }
  return issues;
}

export async function check(dir, options = {}) {
  const root = resolve(dir);
  const appKey = options.appKey ?? "fuyu";
  const allowExperimental = options.allowExperimental ?? true;
  const errors = [];
  const warnings = [];
  const scratch = createScratch("fuyu-plugin-check-");
  try {
    let built = null;
    let manifest = null;
    try {
      const result = await build(root, { ...options, outDir: scratch.dir("package") });
      warnings.push(...result.warnings);
      built = result.outDir;
      manifest = result.manifest;
    } catch (error) {
      if (!(error instanceof BuildError)) throw error;
      errors.push({ code: "build", message: error.message }, ...error.issues);
    }
    const source = manifest ?? safeReadManifest(root);
    errors.push(...checkInterfaces(source, appKey, allowExperimental));
    const listing = options.listing ?? "off";
    if (listing !== "off") (listing === "error" ? errors : warnings).push(...lintListing(root, source, { appKey }));
    const report = review({ newDir: snapshotDirectory(root, scratch.dir("source")), newBuilt: built });
    const listed = new Set(report.summary.dependencies.added.map((item) => `${item.name}@${item.versions.join(", ")}`));
    const domains = new Set(warnings.filter((issue) => issue.code === "undeclared-domain").map((issue) => issue.domain));
    const undeclared = new Set(report.summary.network.undeclared);
    const findings = report.findings.filter((finding) => {
      if (finding.check === "release" || finding.check === "nodeApis") return false;
      if (finding.check === "manifest") return finding.tier === "red" && !(allowExperimental && isExperimental(finding));
      if (finding.check === "network") return undeclared.has(finding.detail) && !domains.has(finding.detail);
      return !(finding.check === "dependencies" && listed.has(finding.detail));
    });
    for (const finding of findings) {
      if (finding.tier === "red") errors.push(fromFinding(finding));
      else if (finding.tier === "yellow") warnings.push(fromFinding(finding));
    }
    return { ok: errors.length === 0, errors, warnings, findings, manifest };
  } finally {
    scratch.dispose();
  }
}
