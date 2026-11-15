import { renderMarkdown, review } from "@fuyu/plugin-review";
import { createScratch, openSource } from "./sources.mjs";

export function reviewSources({ oldSpec, newSpec, repo, path, oldBuilt = null, newBuilt = null }) {
  if (newSpec === "-") throw new Error("the new version cannot be -");
  const scratch = createScratch("fuyu-plugin-review-");
  try {
    const previous = openSource(oldSpec, { repo, path, scratch, label: "old" });
    const next = openSource(newSpec, { repo, path, scratch, label: "new" });
    const report = review({ oldDir: previous?.dir ?? null, newDir: next.dir, oldBuilt, newBuilt });
    const describe = (source) => (source ? { kind: source.kind, spec: source.spec, commit: source.commit, skipped: source.skipped } : null);
    return { report, markdown: renderMarkdown(report), sources: { old: describe(previous), new: describe(next) } };
  } finally {
    scratch.dispose();
  }
}
