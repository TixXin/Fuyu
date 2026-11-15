import { resolve } from "node:path";
import { review } from "@fuyu/plugin-review";
import { build } from "./build.mjs";
import { BuildError } from "./errors.mjs";
import { createScratch, snapshotDirectory } from "./sources.mjs";

function fromFinding(finding) {
  return {
    code: `review:${finding.check}`,
    file: finding.file,
    line: finding.line,
    message: finding.detail ? `${finding.message}: ${finding.detail}` : finding.message,
  };
}

export async function check(dir, options = {}) {
  const root = resolve(dir);
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
    const report = review({ newDir: snapshotDirectory(root, scratch.dir("source")), newBuilt: built });
    const listed = new Set(report.summary.dependencies.added.map((item) => `${item.name}@${item.versions.join(", ")}`));
    const domains = new Set(warnings.filter((issue) => issue.code === "undeclared-domain").map((issue) => issue.domain));
    const undeclared = new Set(report.summary.network.undeclared);
    const findings = report.findings.filter((finding) => {
      if (finding.check === "release" || finding.check === "nodeApis") return false;
      if (finding.check === "manifest") return finding.tier === "red";
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
