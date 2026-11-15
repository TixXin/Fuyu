#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { earlierCalls, hasRead, skillLoaded } from "./evidence.mjs";
import { RULES } from "./rules.mjs";
import { locate, shellCommands } from "./shell.mjs";
import { writeTargets } from "./shellWrites.mjs";

const FILE_TOOLS = ["Write", "Edit", "MultiEdit", "NotebookEdit"];
const SHELL_TOOLS = ["Bash", "PowerShell"];
const SHELL_WRITE = /\bsed\s+-i|>|\btee\b|Set-Content|Add-Content|Out-File|\bmv\b|\bcp\b|Move-Item|Copy-Item/;
const INTERPRETERS = new Set(["node", "bun", "deno", "bash", "sh", "zsh", "pwsh", "powershell", "python", "python3"]);
const DRY_RUN = new Set(["--check", "--test", "--help", "-h"]);
const parsed = new WeakMap();

const commandName = (word) => (word ?? "").replaceAll("\\", "/").split("/").pop().toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
const inside = (path, entry) => (entry.endsWith("/") ? `${path}/`.startsWith(entry) : path === entry);
const covers = (when, path) => when.paths.some((entry) => inside(path, entry)) && !(when.except ?? []).some((entry) => inside(path, entry));

export function repoPath(root, file) {
  const path = relative(root, resolve(root, file)).replaceAll("\\", "/");
  return path.startsWith("..") || isAbsolute(path) ? null : path;
}

function shell(input, root) {
  if (!parsed.has(input)) {
    const command = String(input.tool_input?.command ?? "");
    const powershell = input.tool_name === "PowerShell";
    const base = typeof input.cwd === "string" && input.cwd ? input.cwd : root;
    let commands = [];
    let written = [];
    try {
      commands = shellCommands(command, { powershell });
      written = writeTargets(command, { base, powershell }).map((path) => repoPath(root, path)).filter((path) => path !== null && path !== "");
    } catch {
      commands = [];
    }
    parsed.set(input, { commands, written, base });
  }
  return parsed.get(input);
}

function sequence(words, pattern) {
  const tokens = pattern.split(" ");
  const steps = tokens.filter((token) => !token.startsWith("--"));
  const flags = tokens.filter((token) => token.startsWith("--"));
  for (let i = 0; i < words.length; i += 1) {
    if (commandName(words[i]) !== steps[0]) continue;
    let at = i + 1;
    while (at < words.length && (words[at].startsWith("-") || words[at] === "run")) at += 1;
    const rest = words.slice(at);
    if (steps.slice(1).every((step, index) => rest[index] === step) && flags.every((flag) => rest.includes(flag))) return pattern;
  }
  return null;
}

function commandHit(when, input, root) {
  const { commands, base } = shell(input, root);
  for (const command of commands) {
    for (const pattern of when.commands ?? []) {
      const hit = sequence(command.words, pattern);
      if (hit) return hit;
    }
    let runner = true;
    for (const word of command.words.some((entry) => DRY_RUN.has(entry)) ? [] : command.words) {
      const path = runner && !word.startsWith("-") ? repoPath(root, locate(base, command, word)) : null;
      if (path && (when.scripts ?? []).some((entry) => inside(path, entry))) return path;
      runner = word.startsWith("-") ? runner : INTERPRETERS.has(commandName(word));
    }
  }
  return null;
}

export function touches(rule, input, root, exists = existsSync) {
  const { when } = rule;
  const args = input.tool_input ?? {};
  if (when.tool) {
    return input.tool_name === when.tool && Object.entries(when.input ?? {}).every(([key, value]) => args[key] === value) ? when.tool : null;
  }
  const inShell = SHELL_TOOLS.includes(input.tool_name);
  if (!when.paths) return inShell ? commandHit(when, input, root) : null;
  if (FILE_TOOLS.includes(input.tool_name)) {
    const file = args.file_path ?? args.notebook_path;
    const path = file ? repoPath(root, file) : null;
    if (path === null) return null;
    const created = Boolean(when.created) && input.tool_name === "Write" && when.created.test(path) && !exists(resolve(root, file));
    return covers(when, path) || created ? path : null;
  }
  if (!inShell) return null;
  if (when.shell === "mention") {
    const command = String(args.command ?? "").replaceAll("\\", "/");
    if (!SHELL_WRITE.test(command)) return null;
    return when.paths.find((entry) => command.includes(entry)) ?? null;
  }
  return shell(input, root).written.find((path) => covers(when, path)) ?? null;
}

function message(blocked, agent) {
  const scope = agent ? "这个子代理" : "这次会话";
  const lead = ({ rule, target }) => rule.hint.replaceAll("{target}", target);
  const step = ({ rule }) => (rule.require.skill ? `用 Skill 工具加载 ${rule.require.skill}，照里面写的做` : `把 ${rule.require.read} 读一遍`);
  if (blocked.length === 1) return `${lead(blocked[0])}。先${step(blocked[0])}，再重做这次操作（${scope}只拦一次）。`;
  return [`这次操作碰到 ${blocked.length} 条规则，都补上再重做（每条${scope}只拦一次）：`, ...blocked.map((hit) => `- ${lead(hit)}：先${step(hit)}。`)].join("\n");
}

export function gate(input, { root, exists = existsSync, rules = RULES, readTranscript, marked, mark, settle = () => {}, home }) {
  const hits = rules.map((rule) => ({ rule, target: touches(rule, input, root, exists) })).filter((hit) => hit.target && !marked(hit.rule.id));
  if (!hits.length) return null;
  let transcript = null;
  const text = () => (transcript ??= String(readTranscript() ?? ""));
  const blocked = [];
  for (const hit of hits) {
    const { when, require } = hit.rule;
    if (when.from && earlierCalls(text(), when.tool, when.input, input.tool_use_id) < when.from - 1) continue;
    if (require.skill ? skillLoaded(text(), require.skill) : hasRead(text(), require.read, { root, home })) settle(hit.rule.id);
    else {
      mark(hit.rule.id);
      blocked.push(hit);
    }
  }
  return blocked.length ? message(blocked, Boolean(input.agent_id)) : null;
}

export function activeRules(root, exists = existsSync) {
  return RULES.filter((rule) => !rule.require.skill || exists(join(root, ".claude", "skills", rule.require.skill, "SKILL.md")));
}

export function transcriptFile(input) {
  const main = String(input.transcript_path ?? "");
  return input.agent_id ? join(main.replace(/\.jsonl$/, ""), "subagents", `agent-${input.agent_id}.jsonl`) : main;
}

export function markerDir(input, temp = tmpdir()) {
  const safe = (value, fallback) => String(value ?? "").replace(/[^\w-]/g, "") || fallback;
  return join(temp, "fuyu-gate", safe(input.session_id, "unknown"), safe(input.agent_id, "main"));
}

export function run(input, { root, temp = tmpdir(), env = process.env } = {}) {
  if (env.FUYU_GATE === "off") return null;
  try {
    const dir = markerDir(input, temp);
    const record = (state) => (id) => {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, id), state);
    };
    return gate(input, {
      root,
      rules: activeRules(root),
      readTranscript: () => {
        try {
          return readFileSync(transcriptFile(input), "utf8");
        } catch {
          return "";
        }
      },
      marked: (id) => existsSync(join(dir, id)),
      mark: record("blocked"),
      settle: record("met"),
    });
  } catch {
    return null;
  }
}

export function main() {
  if (process.env.FUYU_GATE === "off") return;
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const text = run(input ?? {}, { root: resolve(dirname(fileURLToPath(import.meta.url)), "..", "..") });
  if (!text) return;
  process.stderr.write(`${text}\n`);
  process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
