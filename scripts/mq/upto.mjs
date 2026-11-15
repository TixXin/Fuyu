import { mergeTree } from "./mergeTree.mjs";
import { INTEGRATION_BRANCH, git, tryGit } from "./settings.mjs";

export function mergedWith(rev, upstream, cwd = process.cwd()) {
  if (tryGit(["merge-base", "--is-ancestor", upstream, rev], cwd).ok) return { rev: git(["rev-parse", rev], cwd), conflicts: [] };
  const { tree, conflicts } = mergeTree(rev, upstream, null, cwd);
  if (!tree) return { rev: null, conflicts };
  const made = tryGit(["commit-tree", tree, "-p", rev, "-p", upstream, "-m", `Merge remote-tracking branch '${upstream}'`], cwd);
  return made.ok ? { rev: made.out, conflicts: [] } : { rev: null, conflicts: [] };
}

export function uptoRev(name, upstream = `origin/${INTEGRATION_BRANCH}`) {
  const found = tryGit(["rev-parse", "--verify", "--quiet", `${name}^{commit}`]);
  if (!found.ok || !found.out) return { error: `找不到提交 ${name}。` };
  const sha = found.out;
  if (!tryGit(["merge-base", "--is-ancestor", sha, "HEAD"]).ok) return { error: `${name} 不在本地 ${INTEGRATION_BRANCH} 上，--upto 只能写本地 ${INTEGRATION_BRANCH} 上的提交。` };
  if (tryGit(["merge-base", "--is-ancestor", sha, upstream]).ok) return { error: `${name} 已经在 ${upstream} 上，没有要合入的。` };
  const { rev, conflicts } = mergedWith(sha, upstream);
  if (!rev) {
    const files = conflicts.length ? `冲突的文件：${conflicts.join("、")}。` : "";
    return { error: `到 ${name} 为止的提交和 ${upstream} 冲突。${files}整批 pnpm mq:land --yes，按提示解决冲突。` };
  }
  const carried = git(["rev-list", "--count", "--no-merges", `${upstream}..${sha}`]);
  return { rev, sha, carried: Number(carried) };
}
