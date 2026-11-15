import { isAbsolute } from "node:path";
import { codeWrites, patchTargets } from "./inlineCode.mjs";
import { locate, operands, shellCommands } from "./shell.mjs";

const WRAPPERS = new Set(["sudo", "env", "command", "nohup", "exec", "nice", "time", "builtin", "noglob", "timeout", "gtimeout", "taskpolicy"]);
const DISCARD = /^(\/dev\/|nul$|\$null$)/i;
const WRITE_OPS = new Set([">", ">>", ">|", "&>"]);
const PS_VALUE = new Set(["-value", "-encoding", "-path", "-literalpath", "-filepath", "-destination", "-name", "-itemtype", "-type", "-filter", "-include", "-exclude", "-inputobject", "-width", "-newname", "-pspath", "-erroraction", "-ea", "-delimiter", "-target"]);
const PS_ALIASES = {
  sc: "set-content", ac: "add-content", ni: "new-item", ri: "remove-item", rm: "remove-item", del: "remove-item", erase: "remove-item", rd: "remove-item", rmdir: "remove-item",
  mv: "move-item", move: "move-item", mi: "move-item", ren: "rename-item", rni: "rename-item", cp: "copy-item", copy: "copy-item", cpi: "copy-item", tee: "tee-object",
};
const NODE_VALUE = new Set(["-r", "--require", "--import", "--loader", "--experimental-loader", "--env-file", "-C", "--conditions"]);

const commandName = (word) => (word ?? "").replaceAll("\\", "/").split("/").pop().toLowerCase().replace(/\.(exe|cmd|bat)$/, "");
const under = (dir, target) => (isAbsolute(target) || /^~|^[A-Za-z]:/.test(target) ? target : `${dir}/${target}`);
const plain = (words) => words.slice(1).filter((word) => word !== "" && !word.startsWith("-"));

function unwrap(words) {
  let rest = words;
  while (rest.length && WRAPPERS.has(commandName(rest[0]))) {
    rest = rest.slice(1);
    while (rest.length && (rest[0].startsWith("-") || /^\w+=/.test(rest[0]) || /^\d+[smhd]?$/.test(rest[0]))) rest = rest.slice(1);
  }
  if (commandName(rest[0]) === "pnpm" && rest[1] === "heavy" && rest.includes("--")) return unwrap(rest.slice(rest.indexOf("--") + 1));
  return rest;
}

function sedFiles(words) {
  if (!words.some((word) => /^-[a-zA-Z]*i/.test(word) || word.startsWith("--in-place"))) return [];
  const files = [];
  let script = false;
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    if (/^-[a-zA-Z]*i$/.test(word) && (words[i + 1] === "" || /^\.\w+$/.test(words[i + 1] ?? ""))) i += 1;
    else if (/^(-[a-zA-Z]*[ef]|--expression|--file)$/.test(word)) {
      script = true;
      i += 1;
    } else if (word.startsWith("-") && word.length > 1) continue;
    else if (!script) script = true;
    else if (word !== "") files.push(word);
  }
  return files;
}

function perlFiles(words) {
  if (!words.some((word) => /^-(?!M)[a-zA-Z0-9]*i/.test(word))) return [];
  const files = [];
  let script = false;
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    if (/^-(?!M)[a-zA-Z0-9.]*[eE]$/.test(word)) {
      script = true;
      i += 1;
    } else if (word.startsWith("-")) continue;
    else if (!script) script = true;
    else if (word !== "") files.push(word);
  }
  return files;
}

function destination(words, includeSources) {
  const files = plain(words);
  const flag = words.findIndex((word) => word === "-t" || word === "--target-directory");
  const named = words.find((word) => word.startsWith("--target-directory="))?.split("=")[1] ?? (flag === -1 ? null : words[flag + 1]);
  if (includeSources) return named ? [...files, named] : files;
  return named ? [named] : files.slice(-1);
}

function optionValue(words, names) {
  const found = [];
  for (let i = 1; i < words.length; i += 1) {
    if (names.includes(words[i]) && words[i + 1]) found.push(words[i + 1]);
    for (const name of names) if (name.startsWith("--") && words[i].startsWith(`${name}=`)) found.push(words[i].slice(name.length + 1));
  }
  return found;
}

function gitTargets(words, command) {
  let dir = null;
  let i = 1;
  while (i < words.length && words[i].startsWith("-")) {
    if (words[i] === "-C" && words[i + 1]) dir = dir ? under(dir, words[i + 1]) : words[i + 1];
    i += words[i] === "-C" || words[i] === "-c" ? 2 : 1;
  }
  const sub = words[i];
  const rest = words.slice(i);
  let files = [];
  if (sub === "mv") files = plain(rest);
  else if (sub === "rm" && !rest.includes("--cached")) files = plain(rest);
  else if (sub === "apply" && !rest.some((word) => /^--(check|stat|numstat|summary|cached)$/.test(word))) files = command.heredocs.flatMap(patchTargets);
  else if (sub === "checkout" && rest.includes("--")) files = rest.slice(rest.indexOf("--") + 1);
  else if (sub === "restore" && (!rest.some((word) => word === "--staged" || word === "-S") || rest.some((word) => word === "--worktree" || word === "-W"))) {
    files = rest.slice(1).filter((word, index, all) => !word.startsWith("-") && !/^(-s|--source)$/.test(all[index - 1] ?? ""));
  }
  return dir ? files.map((file) => under(dir, file)) : files;
}

function findTargets(words, context) {
  const starts = [];
  let i = 1;
  while (i < words.length && !/^[-(!]/.test(words[i])) starts.push(words[i++]);
  const roots = starts.length ? starts : ["."];
  const found = words.includes("-delete") ? [...roots] : [];
  for (let at = i; at < words.length; at += 1) {
    if (!/^-(exec|execdir|ok)$/.test(words[at])) continue;
    let end = at + 1;
    while (end < words.length && words[end] !== ";" && words[end] !== "+") end += 1;
    const inner = words.slice(at + 1, end).filter((word) => word !== "{}");
    found.push(...commandTargets([...inner, ...roots], context));
    at = end;
  }
  return found;
}

function inlineSource(words, context, flags) {
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    if (flags.includes(word)) return { code: words[i + 1] ?? "", args: words.slice(i + 2) };
    if (word === "-") return { code: context.stdin(), args: words.slice(i + 1) };
    if (NODE_VALUE.has(word)) i += 1;
    else if (word === "-m" || word === "--test" || !word.startsWith("-")) return null;
  }
  return { code: context.stdin(), args: [] };
}

function psArguments(words) {
  const named = new Map();
  const positional = [];
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    if (!word.startsWith("-")) positional.push(word);
    else if (word.includes(":") && !/^-\w+:$/.test(word)) named.set(word.slice(0, word.indexOf(":")).toLowerCase(), word.slice(word.indexOf(":") + 1));
    else if (PS_VALUE.has(word.toLowerCase()) && i + 1 < words.length) named.set(word.toLowerCase(), words[++i]);
  }
  const first = named.get("-path") ?? named.get("-literalpath") ?? named.get("-filepath") ?? named.get("-pspath") ?? positional[0];
  const second = named.get("-destination") ?? (named.has("-path") || named.has("-literalpath") ? positional[0] : positional[1]);
  const list = (value) => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : []);
  return { named, first: list(first), second: list(second) };
}

function psTargets(name, words) {
  const { named, first, second } = psArguments(words);
  if (name === "new-item" && named.has("-name")) return (first.length ? first : ["."]).map((dir) => `${dir}/${named.get("-name")}`);
  if (name === "copy-item") return second;
  if (name === "move-item") return [...first, ...second];
  return first;
}

const PS_WRITERS = new Set(["set-content", "add-content", "out-file", "clear-content", "tee-object", "new-item", "remove-item", "rename-item", "export-csv", "move-item", "copy-item"]);

function commandTargets(allWords, context) {
  const words = unwrap(allWords);
  const name = commandName(words[0]);
  const { command } = context;
  const ps = command.powershell ? (PS_ALIASES[name] ?? name) : name;
  if (PS_WRITERS.has(ps)) return psTargets(ps, words);
  if (name === "xargs") {
    let i = 1;
    while (i < words.length && words[i].startsWith("-")) i += /^-[InPLsEd]$/.test(words[i]) ? 2 : 1;
    const inner = words.slice(i).filter((word) => word !== "{}");
    return inner.length ? commandTargets([...inner, ...context.upstream], { ...context, upstream: [] }) : [];
  }
  if (name === "tee") return plain(words);
  if (name === "sed" || name === "gsed") return sedFiles(words);
  if (name === "perl") return perlFiles(words);
  if (name === "mv") return destination(words, true);
  if (["cp", "ln", "rsync", "install"].includes(name)) return destination(words, false);
  if (["rm", "rmdir", "unlink", "touch", "truncate"].includes(name)) return plain(words);
  if (name === "dd") return words.filter((word) => word.startsWith("of=")).map((word) => word.slice(3));
  if (name === "curl") return optionValue(words, ["-o", "--output"]);
  if (name === "wget") return optionValue(words, ["-O", "--output-document"]);
  if (name === "git") return gitTargets(words, command);
  if (name === "find") return findTargets(words, context);
  if (name === "patch") return [...command.heredocs.flatMap(patchTargets), ...plain(words).slice(0, 1).filter((word) => !/\.(diff|patch)$/.test(word))];
  if (name === "apply_patch") return [...command.heredocs, ...plain(words)].flatMap(patchTargets);
  if (/^(python[\d.]*|py)$/.test(name)) {
    const source = inlineSource(words, context, ["-c"]);
    return source ? codeWrites(source.code, "python", source.args) : [];
  }
  if (["node", "bun", "nodejs"].includes(name)) {
    const source = inlineSource(words, context, ["-e", "--eval", "-p", "--print", "-pe"]);
    return source ? codeWrites(source.code, "node", source.args) : [];
  }
  if (["bash", "sh", "zsh", "dash"].includes(name)) {
    const flag = words.findIndex((word, index) => index > 0 && /^-[a-zA-Z]*c$/.test(word));
    const script = plain(words)[0];
    const code = flag !== -1 ? words[flag + 1] : script ? null : context.stdin();
    return code ? context.recurse(code, false) : [];
  }
  if (["powershell", "pwsh"].includes(name)) {
    const flag = words.findIndex((word, index) => index > 0 && /^-(c|command)$/i.test(word));
    if (words.some((word) => /^-(f|file|encodedcommand|e|ec)$/i.test(word))) return [];
    const code = flag !== -1 ? words.slice(flag + 1).join(" ") : plain(words).join(" ");
    return code ? context.recurse(code, true) : [];
  }
  if (name === "cmd") {
    const flag = words.findIndex((word) => /^\/[ck]$/i.test(word));
    return flag === -1 ? [] : context.recurse(words.slice(flag + 1).join(" "), false);
  }
  return [];
}

function dotnetWrites(text) {
  const found = [];
  for (const match of text.matchAll(/IO\.File\]::(?:Write|Append)All\w+\(\s*(?:(['"])([^'"]+)\1|\$(\w+))/gi)) {
    if (match[2]) found.push(match[2]);
    else {
      const bound = text.match(new RegExp(`\\$${match[3]}\\s*=\\s*(['"])([^'"]+)\\1`, "i"));
      if (bound) found.push(bound[2]);
    }
  }
  return found;
}

export function writeTargets(text, { base, powershell = false, home, depth = 0 } = {}) {
  const source = String(text ?? "");
  const commands = shellCommands(source, { powershell });
  const found = [];
  for (const [index, command] of commands.entries()) {
    const at = (target) => locate(base, command, target, home);
    const earlier = commands.slice(0, index).filter((other) => other.pipeline === command.pipeline);
    const context = {
      command,
      upstream: earlier.flatMap(operands),
      stdin: () => command.heredocs[0] ?? (command.piped ? earlier.at(-1)?.heredocs[0] : null) ?? "",
      recurse: (code, shell) => (depth < 3 ? writeTargets(code, { base: at("."), powershell: shell, home, depth: depth + 1 }) : []),
    };
    for (const { op, target } of command.redirects) if (WRITE_OPS.has(op) && target && !DISCARD.test(target)) found.push(at(target));
    for (const target of commandTargets(command.words, context)) if (target && !DISCARD.test(target)) found.push(at(target));
  }
  if (powershell && /IO\.File\]::/i.test(source)) found.push(...dotnetWrites(source).map((target) => locate(base, { cds: [], powershell: true }, target, home)));
  return [...new Set(found)];
}
