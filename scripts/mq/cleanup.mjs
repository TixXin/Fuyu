import { spawnSync } from "node:child_process";
import { landBranchName } from "./github.mjs";

const PICK_SUFFIX = /^-(only|upto)-[0-9a-f]{7}$/;

function run(args) {
  return spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
}

export const remoteGit = {
  contains(older, newer, branch) {
    const check = () => run(["merge-base", "--is-ancestor", older, newer]).status;
    let status = check();
    if (status !== 0 && status !== 1) {
      run(["fetch", "--quiet", "origin", `refs/heads/${branch}`]);
      status = check();
    }
    if (status !== 1) return status === 0;
    const extra = run(["rev-list", "--no-merges", "--count", `${newer}..${older}`]);
    return extra.status === 0 && extra.stdout.trim() === "0";
  },
  branches(prefix) {
    const listed = run(["ls-remote", "origin", `refs/heads/${prefix}*`]);
    if (listed.status !== 0) throw new Error(`${listed.stderr}`.trim() || "git ls-remote 失败");
    return listed.stdout.split("\n").filter(Boolean).map((line) => {
      const [sha, ref] = line.split(/\s+/);
      return { name: ref.replace(/^refs\/heads\//, ""), sha };
    });
  },
  remove(name) {
    const pushed = run(["push", "--quiet", "origin", "--delete", `refs/heads/${name}`]);
    return pushed.status === 0 ? null : `${pushed.stderr}`.trim() || "git push --delete 失败";
  },
};

export function ownBranch(name, { login, hosts, branch, kind = "land" }) {
  return hosts.some((host) => {
    const base = landBranchName(login, host, branch).replace(/^land\//, `${kind}/`);
    if (name === base) return true;
    return kind === "land" && name.startsWith(base) && PICK_SUFFIX.test(name.slice(base.length));
  });
}

export function supersededPrs(open, { pr, head, mine, git }) {
  const close = [];
  const keep = [];
  for (const old of open) {
    const name = old.headRefName ?? "";
    if (old.number === pr || !name.startsWith("land/")) continue;
    if (!ownBranch(name, mine)) keep.push({ ...old, reason: "不是本机的 land 分支，不动" });
    else if (!git.contains(old.headRefOid, head, name)) keep.push({ ...old, reason: "有新 PR 里没有的提交，没关" });
    else close.push(old);
  }
  return { close, keep };
}

export function withSupersedes(body, numbers) {
  return `${`${body ?? ""}`.trimEnd()}\n\n取代 ${numbers.map((n) => `#${n}`).join("、")}（已关闭并删除分支）\n`;
}

export function closeSuperseded({ github, git = remoteGit, pr, head, mine }) {
  let open;
  try {
    open = github.openPrHeads();
  } catch (error) {
    console.error(`[land] 没能列出开着的 PR，旧的 land PR 这次没检查：${`${error.stderr ?? error.message}`.trim()}`);
    return [];
  }
  const { close, keep } = supersededPrs(open, { pr, head, mine, git });
  for (const old of keep) console.log(`[land] #${old.number}（${old.headRefName}）${old.reason}。`);
  const closed = [];
  for (const old of close) {
    try {
      github.closePr(old.number, `被 #${pr} 取代：它的提交都已经在 #${pr} 里。`);
      closed.push(old.number);
      console.log(`[land] #${old.number}（${old.headRefName}）的提交都在 #${pr} 里，已关闭并删除分支。`);
    } catch (error) {
      console.error(`[land] 没能关闭 #${old.number}：${`${error.stderr ?? error.message}`.trim()}`);
    }
  }
  if (!closed.length) return closed;
  try {
    github.setBody(pr, withSupersedes(github.prBody(pr), closed));
  } catch (error) {
    console.error(`[land] 没能在 #${pr} 的正文里写「取代」：${`${error.stderr ?? error.message}`.trim()}`);
  }
  return closed;
}

export function runState(runs, sha) {
  const mine = runs.filter((entry) => entry.headSha === sha);
  if (!mine.length) return "none";
  return mine.every((entry) => entry.status === "completed") ? "done" : "running";
}

const KEEP_REASON = { running: "CI 还在跑", none: "没找到这次推送的 CI 记录" };

export function cleanTry({ github, git = remoteGit, mine }) {
  let branches;
  try {
    branches = git.branches("try/");
  } catch (error) {
    console.error(`[try] 没能列出远程的 try/ 分支：${error.message}`);
    return 1;
  }
  let failed = 0;
  const removed = [];
  for (const { name, sha } of branches) {
    if (!ownBranch(name, { ...mine, kind: "try" })) {
      console.log(`[try] 留着 ${name}：别的机器的或手推的。`);
      continue;
    }
    let state;
    try {
      state = runState(github.runs(name), sha);
    } catch (error) {
      console.error(`[try] 留着 ${name}：没能查到它的 CI（${`${error.stderr ?? error.message}`.trim()}）。`);
      continue;
    }
    if (state !== "done") {
      console.log(`[try] 留着 ${name}：${KEEP_REASON[state]}。`);
      continue;
    }
    const error = git.remove(name);
    if (error) {
      failed += 1;
      console.error(`[try] 删 ${name} 失败：${error}`);
    } else removed.push(name);
  }
  console.log(removed.length ? `✓ 删掉了 CI 跑完的 ${removed.join("、")}。` : "[try] 没有要删的 try/ 分支。");
  return failed ? 1 : 0;
}
