import { LOCKFILES, lineDelta } from "./files.mjs";
import { diffLockfiles } from "./lockfile.mjs";
import { emptyVersion, scanVersion } from "./version.mjs";

export const FORMAT = "fuyu-plugin-review/1";
export const LINE_THRESHOLD = 300;
const TIER_ORDER = { red: 0, yellow: 1, info: 2 };

const SENSITIVE_LABELS = {
  "child-process": "运行程序（child_process）",
  vm: "vm 模块",
  eval: "eval 或把字符串当代码执行",
  "function-constructor": "new Function",
  "native-binding": "process.binding / dlopen",
  "import-nonliteral": "非字面量的动态 import()",
  "require-nonliteral": "非字面量的 require()",
  "home-dir": "用户主目录、临时目录或系统环境变量里的路径",
  "absolute-path": "绝对路径",
  "parent-path": "带 .. 的路径",
  "app-data": "浮屿或别的插件的数据目录",
  "dynamic-url": "运行时拼出来的网址",
};
const OBFUSCATION_LABELS = {
  "obfuscator-names": "混淆器风格的变量名（_0x…）",
  "char-codes": "用 fromCharCode 拼字符串",
  "escape-density": "密集的 \\x / \\u 转义",
  "long-line": "超长行",
  "hex-block": "大块十六进制",
  "base64-block": "大块 base64",
  "high-entropy": "高熵长字符串",
};

function where(locations, limit = 5) {
  return locations.slice(0, limit).map(({ file, line }) => ({ file, line }));
}

function hostAllowed(host, network) {
  return network.some((pattern) => (pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) : host === pattern));
}

function setDiff(before, after) {
  const old = new Set(before);
  const now = new Set(after);
  return { added: [...now].filter((x) => !old.has(x)).sort(), removed: [...old].filter((x) => !now.has(x)).sort() };
}

function fileChecks(previous, next, add) {
  const trees = [["", previous.tree, next.tree]];
  if (next.built) trees.push(["built:", previous.built, next.built]);
  for (const [prefix, before, after] of trees) {
    for (const file of after.files.values()) {
      const path = `${prefix}${file.path}`;
      const old = before?.files.get(file.path);
      const changed = !old || old.hash !== file.hash;
      if (file.kind === "native") add("red", "files", "带 Node 原生扩展（.node）", { file: path });
      else if (file.kind === "executable") add("red", "files", "带可执行程序", { file: path, detail: `${file.size} B` });
      else if (file.kind === "script" && changed) add("yellow", "files", old ? "脚本文件有改动" : "新的脚本文件", { file: path });
      else if (file.kind === "binary" && changed) add("yellow", "files", old ? "二进制文件有改动" : "新的二进制文件", { file: path, detail: `${file.size} B` });
    }
    for (const link of after.symlinks) add("yellow", "files", "符号链接", { file: `${prefix}${link}` });
  }
}

function lineStats(previous, next) {
  const paths = new Set([...previous.tree.files.keys(), ...next.tree.files.keys()]);
  let added = 0;
  let removed = 0;
  const changed = [];
  const created = [];
  const deleted = [];
  for (const path of [...paths].sort()) {
    const old = previous.tree.files.get(path);
    const now = next.tree.files.get(path);
    if (old && now && old.hash === now.hash) continue;
    if (!old) created.push(path);
    else if (!now) deleted.push(path);
    else changed.push(path);
    if (LOCKFILES.has(path.split("/").pop())) continue;
    const delta = lineDelta(old?.text ?? "", now?.text ?? "");
    added += delta.added;
    removed += delta.removed;
  }
  return { added, removed, files: { added: created, removed: deleted, changed } };
}

function dependencyChecks(previous, next, firstRelease, add) {
  const before = previous.facts.dependencies;
  const after = next.facts.dependencies;
  const declared = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (before[key] === after[key]) continue;
    const [field, name] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    declared.push({ field, name, from: before[key] ?? null, to: after[key] ?? null });
    add("yellow", "dependencies", before[key] === undefined ? "package.json 新增依赖" : after[key] === undefined ? "package.json 删除依赖" : "package.json 依赖范围变了", { file: "package.json", detail: `${field}: ${name} ${before[key] ?? "—"} → ${after[key] ?? "—"}` });
  }
  const lock = diffLockfiles(previous.lock.packages, next.lock.packages);
  const lockfile = next.lock.file ?? "lockfile";
  for (const item of lock.added) add("yellow", "dependencies", firstRelease ? "锁文件里的包" : "锁文件里新增的包", { file: lockfile, detail: `${item.name}@${item.versions.join(", ")}` });
  for (const item of lock.changed) add("yellow", "dependencies", "锁文件里换了版本的包", { file: lockfile, detail: `${item.name} ${item.from.join(", ")} → ${item.to.join(", ")}` });
  for (const item of lock.removed) add("yellow", "dependencies", "锁文件里删除的包", { file: lockfile, detail: `${item.name}@${item.versions.join(", ")}` });
  for (const item of lock.tampered) add("yellow", "dependencies", "同一版本的包，内容哈希或下载地址变了", { file: lockfile, detail: `${item.name}@${item.version}` });
  for (const item of lock.installScripts) add("yellow", "dependencies", "依赖带安装脚本", { file: lockfile, detail: `${item.name}@${item.version}` });
  if (next.lock.error) add("yellow", "dependencies", "锁文件读不懂", { file: lockfile, detail: next.lock.error });
  const hasRuntimeDeps = Object.keys(after).some((key) => !key.startsWith("peerDependencies:"));
  if (!next.lock.file && hasRuntimeDeps) add("yellow", "dependencies", "有依赖但没有锁文件（package-lock.json 或 pnpm-lock.yaml）", { file: "package.json" });
  const hooks = Object.keys(next.facts.installHooks).filter((hook) => previous.facts.installHooks[hook] !== next.facts.installHooks[hook]);
  for (const hook of hooks) add("yellow", "dependencies", "package.json 的安装脚本变了", { file: "package.json", detail: `scripts.${hook}` });
  return { declared, lockfile: next.lock.file, ...lock };
}

function sensitiveChecks(previous, next, add) {
  for (const [key, occurrences] of next.sensitive) {
    const before = previous.sensitive.get(key)?.length ?? 0;
    if (occurrences.length <= before) continue;
    const kind = key.slice(0, key.indexOf("\u0000"));
    const first = occurrences[0];
    const detail = before ? `${before} → ${occurrences.length} 处` : occurrences.length > 1 ? `${occurrences.length} 处` : undefined;
    add("yellow", "sensitive", SENSITIVE_LABELS[kind] ?? kind, { file: first.file, line: first.line, snippet: first.snippet, detail, kind, lines: occurrences.map((o) => o.line).slice(0, 10) });
  }
  const count = (list) => {
    const map = new Map();
    for (const item of list) map.set(`${item.kind}\u0000${item.file}`, (map.get(`${item.kind}\u0000${item.file}`) ?? 0) + 1);
    return map;
  };
  const before = count(previous.obfuscation);
  const seen = new Map();
  for (const item of next.obfuscation) {
    const key = `${item.kind}\u0000${item.file}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (item.severity === "yellow" && seen.get(key) <= (before.get(key) ?? 0)) continue;
    add(item.severity, "obfuscation", OBFUSCATION_LABELS[item.kind] ?? item.kind, { file: item.file, line: item.line, snippet: item.snippet, detail: item.detail, kind: item.kind });
  }
}

export function compareVersions(previous, next) {
  const firstRelease = previous === null;
  const base = previous ?? emptyVersion();
  const findings = [];
  const add = (tier, check, message, extra = {}) => findings.push({ tier, check, message, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)) });
  if (firstRelease) add("yellow", "release", "首次上架，没有可比的旧版本：维护者要通读源码");
  if (next.manifestError) add("red", "manifest", "读不到 package.json", { file: "package.json", detail: next.manifestError });

  const facts = next.facts;
  if (facts.experimental.length) add("red", "manifest", "用了实验接口（fuyu.experimental 不为空），市场不收", { file: "package.json", detail: facts.experimental.join(", ") });
  for (const field of ["provides", "replaces"]) {
    const diff = setDiff(base.facts[field], facts[field]);
    for (const item of diff.added) add("yellow", "manifest", `fuyu.${field} 新增`, { file: "package.json", detail: item });
    for (const item of diff.removed) add("yellow", "manifest", `fuyu.${field} 删除`, { file: "package.json", detail: item });
  }
  const networkDiff = setDiff(base.facts.network, facts.network);
  for (const host of networkDiff.added) add("yellow", "network", "fuyu.network 新声明的域名", { file: "package.json", detail: host });

  const modules = setDiff(base.modules.keys(), next.modules.keys());
  for (const name of modules.added) {
    const locations = next.modules.get(name);
    add("yellow", "nodeApis", "新用到的 Node 内置模块", { detail: name, file: locations[0].file, line: locations[0].line, locations: where(locations) });
  }
  if (facts.nodeApis) {
    const undeclared = [...next.modules.keys()].filter((name) => !facts.nodeApis.includes(name)).sort();
    if (undeclared.length) add("yellow", "nodeApis", "代码用到的 Node 模块不在清单的 fuyu.nodeApis 里", { file: "package.json", detail: undeclared.join(", ") });
  }

  const undeclaredDomains = [];
  for (const [host, locations] of [...next.domains].sort(([a], [b]) => a.localeCompare(b))) {
    const isNew = !base.domains.has(host);
    const declared = hostAllowed(host, facts.network);
    if (!declared) undeclaredDomains.push(host);
    if (!isNew && declared) continue;
    const hidden = locations.some((l) => l.concatenated);
    const parts = [isNew ? "新出现的域名" : "域名", declared ? null : "没在 fuyu.network 里声明", hidden ? "由字符串拼接得到" : null].filter(Boolean);
    add("yellow", "network", parts.join("，"), { detail: host, file: locations[0].file, line: locations[0].line, locations: where(locations) });
  }

  const dependencies = dependencyChecks(base, next, firstRelease, add);
  sensitiveChecks(base, next, add);
  fileChecks(base, next, add);
  const lines = lineStats(base, next);
  if (!firstRelease && lines.added + lines.removed > LINE_THRESHOLD) {
    add("yellow", "size", `源码改动超过 ${LINE_THRESHOLD} 行`, { detail: `+${lines.added} / -${lines.removed}` });
  }

  findings.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
  const tier = findings.some((f) => f.tier === "red") ? "red" : findings.some((f) => f.tier === "yellow") ? "yellow" : "green";
  return {
    format: FORMAT,
    tier,
    plugin: { name: facts.name ?? base.facts.name, from: firstRelease ? null : base.facts.version, to: facts.version },
    firstRelease,
    findings,
    summary: {
      nodeApis: { all: [...next.modules.keys()].sort(), added: modules.added, removed: modules.removed, declared: facts.nodeApis },
      network: { declared: facts.network, used: [...next.domains.keys()].sort(), added: setDiff(base.domains.keys(), next.domains.keys()).added, undeclared: undeclaredDomains },
      dependencies,
      manifest: { provides: facts.provides, replaces: facts.replaces, experimental: facts.experimental },
      files: lines.files,
      lines: { added: lines.added, removed: lines.removed, threshold: LINE_THRESHOLD },
      binaries: [...next.tree.files.values()].filter((f) => f.kind !== "text").map((f) => ({ file: f.path, kind: f.kind, size: f.size })),
      built: Boolean(next.built),
    },
  };
}

export function review({ oldDir = null, newDir, oldBuilt = null, newBuilt = null }) {
  if (!newDir) throw new TypeError("newDir is required");
  const previous = oldDir ? scanVersion(oldDir, oldBuilt) : null;
  return compareVersions(previous, scanVersion(newDir, newBuilt));
}
