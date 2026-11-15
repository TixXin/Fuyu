import { builtinModules } from "node:module";
import { lex, lineAt, lineStarts } from "./lexer.mjs";

const BUILTINS = new Set(builtinModules.filter((name) => !name.startsWith("_")).map((name) => name.split("/")[0]));
const FILE_EXTENSIONS = new Set(["js", "mjs", "cjs", "ts", "mts", "cts", "jsx", "tsx", "json", "css", "html", "htm", "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "md", "txt", "map", "node", "wasm", "lock", "yaml", "yml", "toml", "xml", "zip", "fuyu", "log", "csv", "py", "rs", "sh", "ps1", "exe", "dll", "mp3", "wav", "ogg", "woff", "woff2", "ttf"]);
const PROPERTY_LIKE = new Set(["id", "in", "is", "it", "at", "as", "to", "do", "on", "no", "or", "so", "go", "my", "me", "us"]);
const COMMON_TLDS = new Set(["com", "net", "org", "io", "dev", "app", "ai", "xyz", "info", "biz", "top", "site", "online", "tech", "cloud", "store", "shop", "live", "pro", "club", "vip", "link", "click", "fun", "space", "website", "page", "run", "workers", "pages", "ngrok", "onion", "gov", "edu", "mil", "int", "museum", "name", "mobi"]);
const IGNORED_HOSTS = /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\]|www\.w3\.org|(?:[\w-]+\.)*example\.(?:com|org|net))$/i;
const URL_PATTERN = /\b(?:https?|wss?|ftp):\/\/([^/\s"'`:?#$\\]+)/gi;
const SCHEME_ONLY = /^(?:https?|wss?):\/\/[^/?#]*$/i;
const IMPORT_BEFORE = /(?:(?:^|[^\w$.])from|(?:^|[^\w$.])import|(?:^|[^\w$.])require\s*\(|(?:^|[^\w$.])import\s*\()\s*$/;

export function normalizeHost(host) {
  return host.toLowerCase().replace(/\.$/, "");
}

export function isHost(value, strict) {
  const host = normalizeHost(value);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) return false;
  const tld = host.slice(host.lastIndexOf(".") + 1);
  if (FILE_EXTENSIONS.has(tld)) return false;
  if (!strict) return true;
  if (PROPERTY_LIKE.has(tld)) return false;
  return tld.length === 2 || COMMON_TLDS.has(tld);
}

function hostsIn(value, strict) {
  const found = [];
  for (const match of value.matchAll(URL_PATTERN)) {
    const host = normalizeHost(match[1].replace(/^[^@]*@/, ""));
    if (isHost(host, false)) found.push(host);
  }
  if (!found.length && isHost(value.trim(), strict)) found.push(normalizeHost(value.trim()));
  return found.filter((host) => !IGNORED_HOSTS.test(host));
}

function chains(masked, strings) {
  const sorted = [...strings].sort((a, b) => a.start - b.start);
  const result = [];
  let index = 0;
  while (index < sorted.length) {
    const chain = [sorted[index]];
    while (index + 1 < sorted.length && /^\s*\+\s*$/.test(masked.slice(sorted[index].end, sorted[index + 1].start))) {
      index += 1;
      chain.push(sorted[index]);
    }
    const last = chain[chain.length - 1];
    result.push({ parts: chain, value: chain.map((s) => s.value).join(""), start: chain[0].start, plusAfter: /^\s*\+/.test(masked.slice(last.end, last.end + 40)) });
    index += 1;
  }
  for (let i = 0; i < sorted.length; i += 1) {
    if (!/\[\s*$/.test(masked.slice(Math.max(0, sorted[i].start - 20), sorted[i].start))) continue;
    const parts = [sorted[i]];
    let j = i;
    while (j + 1 < sorted.length && /^\s*,\s*$/.test(masked.slice(sorted[j].end, sorted[j + 1].start))) parts.push(sorted[++j]);
    const tail = masked.slice(sorted[j].end, sorted[j].end + 40);
    const join = /^\s*,?\s*\]\s*\.\s*join\s*\(\s*(\S?)/.exec(tail);
    if (parts.length < 2 || !join) continue;
    const separatorString = join[1] === '"' || join[1] === "'" || join[1] === "`" ? sorted[j + 1] : null;
    const separator = separatorString ? separatorString.value : join[1] === ")" ? "," : "";
    result.push({ parts, value: parts.map((s) => s.value).join(separator), start: parts[0].start, plusAfter: false });
  }
  return result;
}

function moduleSpecifiers(masked, strings) {
  return strings
    .filter((s) => !(s.template && s.expressions) && IMPORT_BEFORE.test(masked.slice(Math.max(0, s.start - 40), s.start)))
    .map((s) => ({ specifier: s.value, start: s.start, string: s }));
}

export function builtinName(specifier) {
  const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  const name = bare.split("/")[0];
  if (specifier.startsWith("node:")) return name;
  return BUILTINS.has(name) ? name : null;
}

function dynamicLoads(masked, strings, push) {
  const byStart = new Map(strings.map((s) => [s.start, s]));
  for (const match of masked.matchAll(/(?<![\w$.])(import|require)\s*\(/g)) {
    let position = match.index + match[0].length;
    while (/\s/.test(masked[position] ?? "")) position += 1;
    const literal = byStart.get(position);
    const literalOk = literal && !(literal.template && literal.expressions) && /^\s*[),]/.test(masked.slice(literal.end, literal.end + 20));
    if (!literalOk) push(match[1] === "require" ? "require-nonliteral" : "import-nonliteral", match.index);
  }
}

function entropy(value) {
  const counts = new Map();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let bits = 0;
  for (const count of counts.values()) {
    const p = count / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

const SENSITIVE_CODE = [
  ["eval", /(?<![\w$])eval\s*\(|\(\s*0\s*,\s*eval\s*\)/g],
  ["function-constructor", /(?<![\w$.])(?:new\s+)?Function\s*\(/g],
  ["eval", /(?<![\w$.])set(?:Timeout|Interval|Immediate)\s*\(\s*["'`]/g],
  ["native-binding", /\bprocess\s*\.\s*(?:binding|_linkedBinding|dlopen)\s*\(/g],
  ["home-dir", /\b(?:homedir|tmpdir|userInfo)\s*\(/g],
];
const SENSITIVE_STRIPPED = [["home-dir", /\bprocess\s*\.\s*env\s*(?:\.\s*|\[\s*["'`])(?:HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|TEMP|TMP|TMPDIR|XDG_[A-Z_]+)\b/g]];
const ABSOLUTE_PATH = /^(?:\/(?:Users|home|etc|var|tmp|private|Library|System|usr|opt|root|Applications|Volumes)(?:\/|$)|[A-Za-z]:[\\/]|\\\\[^\\]|~[\\/])/;
const HOME_IN_STRING = /(?:^|[\s"'=:])~[\\/]|\$HOME\b|%(?:USERPROFILE|APPDATA|LOCALAPPDATA)%|(?:^|[\\/])\.ssh(?:[\\/]|$)/i;
const PARENT_PATH = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
const APP_DATA = /com\.tixxin\.fuyu|com\.focusd\.island|focusd-island|fly-island|(?:^|[\\/])\.fuyu(?:[\\/]|$)|[\\/]plugins[\\/]@?[\w.-]+|agent-status\.json/i;

export function scanCode(text) {
  const { masked, stripped, strings } = lex(text);
  const starts = lineStarts(text);
  const lines = text.split(/\r?\n/);
  const at = (offset) => lineAt(starts, offset);
  const snippet = (line) => (lines[line - 1] ?? "").trim().slice(0, 160);
  const sensitive = [];
  const push = (kind, offset, detail) => {
    const line = at(offset);
    sensitive.push({ kind, line, snippet: snippet(line), ...(detail ? { detail } : {}) });
  };

  const modules = [];
  const specifierStrings = new Set();
  for (const { specifier, start, string } of moduleSpecifiers(masked, strings)) {
    specifierStrings.add(string);
    const name = builtinName(specifier);
    if (!name) continue;
    modules.push({ name, specifier, line: at(start) });
    if (name === "child_process") push("child-process", start, specifier);
    if (name === "vm") push("vm", start, specifier);
  }

  dynamicLoads(masked, strings, push);
  for (const [kind, pattern] of SENSITIVE_CODE) for (const match of masked.matchAll(pattern)) push(kind, match.index);
  for (const [kind, pattern] of SENSITIVE_STRIPPED) for (const match of stripped.matchAll(pattern)) push(kind, match.index);

  for (const s of strings) {
    if (specifierStrings.has(s)) continue;
    for (const part of s.parts) {
      if (ABSOLUTE_PATH.test(part)) push("absolute-path", s.start, part.slice(0, 80));
      else if (PARENT_PATH.test(part)) push("parent-path", s.start, part.slice(0, 80));
      if (HOME_IN_STRING.test(part)) push("home-dir", s.start, part.slice(0, 80));
      if (APP_DATA.test(part)) push("app-data", s.start, part.slice(0, 80));
    }
  }

  const domains = [];
  const seen = new Set();
  for (const chain of chains(masked, strings)) {
    if (chain.parts.length === 1 && specifierStrings.has(chain.parts[0])) continue;
    const joined = chain.parts.length > 1;
    for (const host of hostsIn(chain.value, !joined || chain.value.length < 80)) {
      const key = `${host}:${chain.start}`;
      if (seen.has(key)) continue;
      seen.add(key);
      domains.push({ domain: host, line: at(chain.start), concatenated: joined && !chain.parts.some((p) => hostsIn(p.value, true).includes(host)) });
    }
    const first = chain.parts[0];
    const runtimeUrl = (SCHEME_ONLY.test(chain.value) && chain.plusAfter) || (first.template && first.expressions && SCHEME_ONLY.test(first.parts[0]));
    if (runtimeUrl) push("dynamic-url", chain.start, chain.value.slice(0, 80));
  }

  const obfuscation = [];
  const flag = (kind, severity, line, detail) => obfuscation.push({ kind, severity, line, snippet: snippet(line).slice(0, 80), ...(detail ? { detail } : {}) });
  const hexNames = new Set(masked.match(/\b_0x[0-9a-f]{4,}\b/gi) ?? []);
  if (hexNames.size >= 3) flag("obfuscator-names", "red", at(masked.search(/\b_0x[0-9a-f]{4,}\b/i)), `${hexNames.size}`);
  for (const match of masked.matchAll(/fromCharCode\s*\(\s*(?:0x[0-9a-f]+|\d+)(?:\s*,\s*(?:0x[0-9a-f]+|\d+)){7,}/gi)) flag("char-codes", "red", at(match.index));
  lines.forEach((line, index) => {
    const escapes = line.match(/\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]+\}/g) ?? [];
    const escapeLength = escapes.reduce((sum, e) => sum + e.length, 0);
    if (escapes.length >= 8 && escapeLength >= line.trim().length * 0.4) flag("escape-density", "red", index + 1, `${escapes.length}`);
    if (line.length > 1000) flag("long-line", "yellow", index + 1, `${line.length}`);
  });
  for (const s of strings) {
    const value = s.value;
    if (value.length < 160) continue;
    if (/(?:[0-9a-fA-F]{2}){80,}/.test(value)) flag("hex-block", "yellow", at(s.start), `${value.length}`);
    else if (/[A-Za-z0-9+/_-]{160,}={0,2}/.test(value)) flag("base64-block", "yellow", at(s.start), `${value.length}`);
    else if (value.length >= 200 && entropy(value) >= 4.5) flag("high-entropy", "yellow", at(s.start), `${value.length}`);
  }

  return { modules, domains, sensitive, obfuscation };
}
