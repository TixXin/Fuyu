import { homedir } from "node:os";
import { resolve } from "node:path";

const MARK = "\u0000";
const KEYWORDS = new Set(["do", "then", "else", "elif", "if", "while", "until", "!", "{", "}", "time", "done", "fi"]);
const DECLARE = new Set(["export", "local", "declare", "readonly", "typeset"]);
const CHANGE_DIR = new Set(["cd", "pushd", "chdir", "set-location", "push-location", "sl"]);
const ASSIGN = /^([A-Za-z_]\w*)=(.*)$/s;
const ROOT_PROBES = ["pwd", "git rev-parse --show-toplevel"];

function open(state, piped = false) {
  return { words: [], redirects: [], heredocs: [], expect: null, pipeline: state.pipeline, piped };
}

function pushWord(command, word) {
  if (command.expect === "<<<") command.heredocs.push(word);
  else if (command.expect) command.redirects.push({ op: command.expect, target: word });
  else command.words.push(word);
  command.expect = null;
}

function readBodies(state) {
  for (const { command, delimiter, strip } of state.pending.splice(0)) {
    const lines = [];
    let closed = false;
    while (state.i < state.text.length && !closed) {
      const end = state.text.indexOf("\n", state.i);
      const stop = end === -1 ? state.text.length : end;
      const line = state.text.slice(state.i, stop).replace(/\r$/, "");
      state.i = Math.min(stop + 1, state.text.length);
      if ((strip ? line.replace(/^\t+/, "") : line) === delimiter) closed = true;
      else lines.push(line);
    }
    command.heredocs.push(lines.join("\n"));
  }
}

function readDelimiter(state) {
  const { text } = state;
  while (text[state.i] === " " || text[state.i] === "\t") state.i += 1;
  let delimiter = "";
  while (state.i < text.length && !/[\s;&|<>()]/.test(text[state.i])) {
    const c = text[state.i];
    if (c === "'" || c === '"') {
      const end = text.indexOf(c, state.i + 1);
      if (end === -1) break;
      delimiter += text.slice(state.i + 1, end);
      state.i = end + 1;
    } else {
      if (c === "\\") state.i += 1;
      delimiter += text[state.i] ?? "";
      state.i += 1;
    }
  }
  return delimiter;
}

function nested(state, closer) {
  const start = state.commands.length;
  const pipeline = state.pipeline;
  state.pipeline += 1;
  parse(state, closer);
  state.pipeline = pipeline;
  state.substitutions.push({ start, end: state.commands.length });
  return `${MARK}${state.substitutions.length - 1}${MARK}`;
}

function hereString(state, quote) {
  const close = state.text.indexOf(`\n${quote}@`, state.i);
  const end = close === -1 ? state.text.length : close;
  const body = state.text.slice(state.text.indexOf("\n", state.i) + 1, end);
  state.i = Math.min(end + 3, state.text.length);
  return body;
}

function quoted(state, quote) {
  const { text, powershell } = state;
  const escape = powershell ? "`" : "\\";
  let value = "";
  state.i += 1;
  while (state.i < text.length && text[state.i] !== quote) {
    const c = text[state.i];
    if (quote === '"' && c === escape && state.i + 1 < text.length) {
      const next = text[state.i + 1];
      value += powershell || '"\\$`\n'.includes(next) ? (next === "\n" ? "" : next) : c + next;
      state.i += 2;
    } else if (quote === '"' && c === "$" && text[state.i + 1] === "(") {
      state.i += 2;
      value += nested(state, ")");
    } else if (quote === '"' && c === "`" && !powershell) {
      state.i += 1;
      value += nested(state, "`");
    } else {
      value += c;
      state.i += 1;
    }
  }
  state.i += 1;
  return value;
}

function parse(state, closer) {
  const { text, powershell } = state;
  const escape = powershell ? "`" : "\\";
  let command = open(state);
  let word = null;
  const endWord = () => {
    if (word !== null) pushWord(command, word);
    word = null;
  };
  const endCommand = (pipe = false) => {
    endWord();
    if (command.words.length || command.redirects.length || command.heredocs.length) state.commands.push(command);
    if (!pipe) state.pipeline += 1;
    command = open(state, pipe);
  };
  const redirect = (op) => {
    if (word !== null && /^(\d+|\*)$/.test(word)) word = null;
    endWord();
    if (text[state.i] === "&") {
      state.i += 1;
      while (/[\d-]/.test(text[state.i] ?? "")) state.i += 1;
    } else command.expect = op;
  };
  while (state.i < text.length) {
    const c = text[state.i];
    const next = text[state.i + 1];
    if (closer && c === closer) {
      state.i += 1;
      break;
    }
    if (c === "\n") {
      endCommand();
      state.i += 1;
      if (state.pending.length) readBodies(state);
    } else if (c === "\r" || c === " " || c === "\t") {
      endWord();
      state.i += 1;
    } else if (c === escape && state.i + 1 < text.length) {
      const skip = next === "\r" && text[state.i + 2] === "\n" ? 3 : 2;
      if (next !== "\n" && skip === 2) word = (word ?? "") + next;
      state.i += skip;
    } else if (powershell && c === "@" && (next === "'" || next === '"') && /^\s*\n/.test(text.slice(state.i + 2, text.indexOf("\n", state.i) + 1))) {
      state.i += 2;
      word = (word ?? "") + hereString(state, next);
    } else if (c === "'" || c === '"') {
      word = (word ?? "") + quoted(state, c);
    } else if (c === "$" && next === "(") {
      state.i += 2;
      word = (word ?? "") + nested(state, ")");
    } else if (c === "`" && !powershell) {
      state.i += 1;
      word = (word ?? "") + nested(state, "`");
    } else if ((c === "<" || c === ">") && next === "(" && !powershell) {
      state.i += 2;
      word = (word ?? "") + nested(state, ")");
    } else if (c === "#" && word === null) {
      const end = text.indexOf("\n", state.i);
      state.i = end === -1 ? text.length : end;
    } else if (c === ">") {
      const op = next === ">" ? ">>" : next === "|" ? ">|" : ">";
      state.i += op.length;
      redirect(op);
    } else if (c === "&" && next === ">") {
      endWord();
      state.i += text[state.i + 2] === ">" ? 3 : 2;
      redirect("&>");
    } else if (c === "<" && next === "<" && text[state.i + 2] === "<") {
      endWord();
      state.i += 3;
      command.expect = "<<<";
    } else if (c === "<" && next === "<" && !powershell) {
      endWord();
      const strip = text[state.i + 2] === "-";
      state.i += strip ? 3 : 2;
      state.pending.push({ command, delimiter: readDelimiter(state), strip });
    } else if (c === "<") {
      state.i += 1;
      redirect("<");
    } else if (c === "&" || c === ";") {
      endCommand();
      state.i += next === c ? 2 : 1;
    } else if (c === "|") {
      endCommand(next !== "|");
      state.i += next === "|" || next === "&" ? 2 : 1;
    } else if (c === "(" || c === ")" || (powershell && (c === "{" || c === "}"))) {
      endCommand();
      state.i += 1;
    } else {
      word = (word ?? "") + c;
      state.i += 1;
    }
  }
  endCommand();
}

export function lex(text, { powershell = false } = {}) {
  const state = { text: String(text ?? ""), i: 0, powershell, commands: [], pending: [], pipeline: 0, substitutions: [] };
  parse(state, null);
  return state;
}

const isOption = (word) => word.startsWith("-");

export function operands(command) {
  return command.words.slice(1).filter((word) => word !== "" && !isOption(word));
}

function expander(vars, state) {
  const inner = (index) => state.commands.slice(state.substitutions[index].start, state.substitutions[index].end);
  const fill = (word) =>
    word.replace(new RegExp(`${MARK}(\\d+)${MARK}`, "g"), (whole, index) => {
      const commands = inner(Number(index));
      return commands.length === 1 && ROOT_PROBES.includes(commands[0].words.join(" ")) ? "." : whole;
    });
  return (word) => {
    const whole = word.match(new RegExp(`^${MARK}(\\d+)${MARK}$`));
    if (whole && fill(word) === word) return inner(Number(whole[1])).flatMap(operands);
    let results = [fill(word)];
    for (const match of word.matchAll(/\$\{?([A-Za-z_]\w*)\}?/g)) {
      const values = vars.get(match[1]);
      if (values?.length) results = results.flatMap((result) => values.map((value) => result.replace(match[0], () => value)));
    }
    return results;
  };
}

export function shellCommands(text, { powershell = false } = {}) {
  const state = lex(text, { powershell });
  const vars = new Map([["PWD", ["."]], ["CLAUDE_PROJECT_DIR", ["."]]]);
  const expand = expander(vars, state);
  const cds = [];
  const out = [];
  for (const raw of state.commands) {
    let words = raw.words.slice();
    while (!powershell && words.length && KEYWORDS.has(words[0])) words.shift();
    if (!powershell && words[0] === "for" && words[2] === "in") {
      vars.set(words[1], words.slice(3).flatMap(expand));
      continue;
    }
    if (powershell && /^\$\w+$/.test(words[0] ?? "") && words[1] === "=") {
      vars.set(words[0].slice(1), words.slice(2, 3).flatMap(expand));
      continue;
    }
    if (powershell && words.length === 1 && /^\$\w+=./.test(words[0])) {
      vars.set(words[0].slice(1, words[0].indexOf("=")), expand(words[0].slice(words[0].indexOf("=") + 1)));
      continue;
    }
    if (DECLARE.has(words[0]) && words.slice(1).some((word) => ASSIGN.test(word))) words.shift();
    while (!powershell && words.length && ASSIGN.test(words[0])) {
      const [, name, value] = words.shift().match(ASSIGN);
      vars.set(name, expand(value));
    }
    words = words.flatMap(expand);
    const redirects = raw.redirects.flatMap(({ op, target }) => expand(target).map((value) => ({ op, target: value })));
    if (!words.length && !redirects.length && !raw.heredocs.length) continue;
    const name = (words[0] ?? "").toLowerCase();
    const command = { words, redirects, heredocs: raw.heredocs, pipeline: raw.pipeline, piped: raw.piped, cds: cds.slice(), powershell };
    if (name === "read" && raw.piped) {
      const upstream = out.filter((other) => other.pipeline === raw.pipeline).flatMap(operands);
      for (const variable of operands(command)) vars.set(variable, upstream);
    }
    if (CHANGE_DIR.has(name)) {
      const target = operands(command)[0];
      if (target && target !== "-") cds.push(target);
    }
    out.push(command);
  }
  return out;
}

export function locate(base, command, target, home = homedir()) {
  const clean = (path) => {
    const slashed = command.powershell ? path.replaceAll("\\", "/") : path;
    return slashed.replace(/^~(?=\/|$)/, home).replace(/^\$(\{HOME\}|HOME\b|env:USERPROFILE\b)/, home);
  };
  return resolve(base, ...command.cds.map(clean), clean(target));
}
