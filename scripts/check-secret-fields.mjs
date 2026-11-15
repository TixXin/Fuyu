import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SCAN_ROOT = "src-tauri/src";
export const SECRET_WORDS = [
  ["token"],
  ["secret"],
  ["password"],
  ["passwd"],
  ["apikey"],
  ["api", "key"],
  ["authorization"],
  ["cookie"],
  ["credential"],
  ["private", "key"],
  ["device", "key"],
];
const STRING_CORES = new Set(["String", "str", "Value", "serde_json::Value", "JsonValue"]);
const WRAPPERS = new Set(["Option", "Vec", "Box", "Arc", "Rc", "Cow"]);

export function isSecretName(name) {
  const parts = name.replace(/^r#/, "").toLowerCase().split("_").filter(Boolean);
  const singular = parts.map((part) => (part.length > 3 && part.endsWith("s") ? part.slice(0, -1) : part));
  return SECRET_WORDS.some((word) =>
    [parts, singular].some((list) => list.some((_, at) => word.every((piece, offset) => list[at + offset] === piece))),
  );
}

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at];
    if (char === "<" || char === "(" || char === "[") depth += 1;
    else if (char === ">" || char === ")" || char === "]") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(text.slice(start, at));
      start = at + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

export function isStringType(type) {
  let core = type.replace(/\s+/g, " ").trim();
  for (;;) {
    core = core.replace(/^&\s*('\w+\s+)?(mut\s+)?/, "").trim();
    const generic = /^(?:(?:std|alloc)::(?:\w+::)*)?(\w+)\s*<(.*)>$/s.exec(core);
    if (!generic || !WRAPPERS.has(generic[1])) break;
    const args = splitTopLevel(generic[2]).filter((arg) => !arg.startsWith("'"));
    if (args.length !== 1) return false;
    core = args[0];
  }
  return STRING_CORES.has(core.replace(/^::/, ""));
}

export function maskSource(source) {
  const out = source.split("");
  const blank = (from, to) => {
    for (let at = from; at < to; at += 1) if (out[at] !== "\n") out[at] = " ";
  };
  let at = 0;
  while (at < source.length) {
    const rest = source.slice(at, at + 3);
    if (rest.startsWith("//")) {
      const end = source.indexOf("\n", at);
      const stop = end < 0 ? source.length : end;
      blank(at, stop);
      at = stop;
    } else if (rest.startsWith("/*")) {
      const end = source.indexOf("*/", at + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(at, stop);
      at = stop;
    } else if (/^b?r#*"/.test(source.slice(at, at + 40)) && !/\w/.test(source[at - 1] ?? "")) {
      const open = /^b?r(#*)"/.exec(source.slice(at, at + 40));
      const close = `"${open[1]}`;
      const end = source.indexOf(close, at + open[0].length);
      const stop = end < 0 ? source.length : end + close.length;
      blank(at + open[0].length, stop - close.length);
      at = stop;
    } else if (source[at] === '"') {
      let end = at + 1;
      while (end < source.length && source[end] !== '"') end += source[end] === "\\" ? 2 : 1;
      blank(at + 1, end);
      at = end + 1;
    } else if (source[at] === "'" && /^'(\\.[^']*|[^\\'])'/.test(source.slice(at, at + 12))) {
      const literal = /^'(\\.[^']*|[^\\'])'/.exec(source.slice(at, at + 12))[0];
      blank(at + 1, at + literal.length - 1);
      at += literal.length;
    } else {
      at += 1;
    }
  }
  return out.join("");
}

function matchingBrace(text, open) {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    if (text[at] === "{") depth += 1;
    else if (text[at] === "}") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return text.length - 1;
}

function withoutTestModules(text) {
  let result = text;
  const pattern = /#\[cfg\(test\)\]\s*(?:#\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?mod\s+\w+\s*\{/g;
  for (let match = pattern.exec(result); match; match = pattern.exec(result)) {
    const open = match.index + match[0].length - 1;
    const close = matchingBrace(result, open);
    result = result.slice(0, match.index) + result.slice(match.index, close + 1).replace(/[^\n]/g, " ") + result.slice(close + 1);
  }
  return result;
}

function leadingAttributes(text, end) {
  const attributes = [];
  let cursor = end;
  for (;;) {
    const before = text.slice(0, cursor).replace(/\s+$/, "");
    if (!before.endsWith("]")) break;
    let depth = 0;
    let at = before.length - 1;
    for (; at >= 0; at -= 1) {
      if (before[at] === "]") depth += 1;
      else if (before[at] === "[") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (at < 1 || before[at - 1] !== "#") break;
    attributes.unshift(before.slice(at - 1));
    cursor = at - 1;
  }
  return attributes;
}

export function isSkipped(attributes) {
  return attributes.some((attribute) => {
    const serde = /^#\[\s*serde\s*\((.*)\)\s*\]$/s.exec(attribute);
    if (!serde) return false;
    return splitTopLevel(serde[1]).some((item) => /^(skip|skip_serializing)$/.test(item.trim()));
  });
}

function parseFields(body, offset) {
  const fields = [];
  let start = 0;
  let depth = 0;
  for (let at = 0; at <= body.length; at += 1) {
    const char = body[at];
    if (char === "<" || char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ">" || char === ")" || char === "]" || char === "}") depth -= 1;
    if (at < body.length && !(char === "," && depth === 0)) continue;
    const chunk = body.slice(start, at);
    const attributes = [];
    let rest = chunk;
    for (let attribute = /^\s*(#\[)/.exec(rest); attribute; attribute = /^\s*(#\[)/.exec(rest)) {
      const open = attribute.index + attribute[0].length - 1;
      let level = 0;
      let close = open;
      for (; close < rest.length; close += 1) {
        if (rest[close] === "[") level += 1;
        else if (rest[close] === "]" && --level === 0) break;
      }
      attributes.push(rest.slice(attribute.index, close + 1).trim());
      rest = rest.slice(close + 1);
    }
    const field = /^\s*(?:pub(?:\([^)]*\))?\s+)?((?:r#)?\w+)\s*:\s*([\s\S]+?)\s*$/.exec(rest);
    if (field) {
      const position = offset + start + chunk.length - rest.length + rest.search(/\S/);
      fields.push({ name: field[1].replace(/^r#/, ""), type: field[2], attributes, position });
    }
    start = at + 1;
  }
  return fields;
}

function lineAt(text, position) {
  let line = 1;
  for (let at = 0; at < position; at += 1) if (text[at] === "\n") line += 1;
  return line;
}

export function findSecretFields(source) {
  const text = withoutTestModules(maskSource(source));
  const findings = [];
  const item = /(?:^|[\s;}])(?:pub(?:\([^)]*\))?\s+)?(struct|enum)\s+(\w+)(?:\s*<[^{;(]*>)?(?:\s*where[^{;]*)?\s*([{;(])/g;
  for (let match = item.exec(text); match; match = item.exec(text)) {
    const [whole, kind, name, opener] = match;
    if (opener !== "{") continue;
    const declaration = match.index + whole.search(/\S/) + (/^[;}]/.test(whole) ? 1 : 0);
    const attributes = leadingAttributes(text, declaration);
    const derives = attributes.some((attribute) => /derive\s*\([^)]*\bSerialize\b/s.test(attribute));
    if (!derives) continue;
    const open = match.index + whole.length - 1;
    const close = matchingBrace(text, open);
    const body = text.slice(open + 1, close);
    const groups = [];
    if (kind === "struct") {
      groups.push({ body, offset: open + 1, variant: null });
    } else {
      const variant = /((?:#\[[^\]]*\]\s*)*)(\w+)\s*\{/g;
      for (let found = variant.exec(body); found; found = variant.exec(body)) {
        const variantOpen = found.index + found[0].length - 1;
        const variantClose = matchingBrace(body, variantOpen);
        if (!isSkipped(found[1].match(/#\[[^\]]*\]/g) ?? [])) {
          groups.push({ body: body.slice(variantOpen + 1, variantClose), offset: open + 1 + variantOpen + 1, variant: found[2] });
        }
        variant.lastIndex = variantClose + 1;
      }
    }
    for (const group of groups) {
      for (const field of parseFields(group.body, group.offset)) {
        if (isSkipped(field.attributes) || !isSecretName(field.name) || !isStringType(field.type)) continue;
        findings.push({
          type: group.variant ? `${name}::${group.variant}` : name,
          field: field.name,
          fieldType: field.type.replace(/\s+/g, " "),
          line: lineAt(text, field.position),
        });
      }
    }
    item.lastIndex = close + 1;
  }
  return findings;
}

export function compare(found, allowlist) {
  const key = ({ file, type, field }) => `${file}\0${type}\0${field}`;
  const allowed = new Map(allowlist.map((entry) => [key(entry), entry]));
  const seen = new Set();
  const errors = [];
  for (const finding of found) {
    seen.add(key(finding));
    if (!allowed.has(key(finding))) {
      errors.push(`${finding.file}:${finding.line} ${finding.type}.${finding.field}: ${finding.fieldType} 可能把密钥序列化给窗口`);
    }
  }
  for (const entry of allowlist) {
    if (!entry.reason || !String(entry.reason).trim()) errors.push(`白名单 ${entry.file} ${entry.type}.${entry.field} 没写 reason`);
    if (!seen.has(key(entry))) errors.push(`白名单 ${entry.file} ${entry.type}.${entry.field} 已经不再命中，请从白名单删除`);
  }
  return errors;
}

function rustFiles(directory, root) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...rustFiles(path, root));
    else if (entry.name.endsWith(".rs") && entry.name !== "tests.rs") files.push(relative(root, path).split(sep).join("/"));
  }
  return files.sort();
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const allowlist = JSON.parse(readFileSync(join(root, "scripts", "secret-fields-allowlist.json"), "utf8")).entries;
  const found = [];
  for (const file of rustFiles(join(root, SCAN_ROOT), root)) {
    for (const finding of findSecretFields(readFileSync(join(root, file), "utf8"))) found.push({ file, ...finding });
  }
  if (process.argv.includes("--list")) {
    for (const { file, line, type, field, fieldType } of found) console.log(`${file}:${line} ${type}.${field}: ${fieldType}`);
  }
  const errors = compare(found, allowlist);
  for (const error of errors) console.error(`[check:secrets] ${error}`);
  if (errors.length > 0) {
    console.error("[check:secrets] 命令和事件不返回密钥明文，见 docs/architecture/plugins/v3-secrets.md「怎么守住」。");
    console.error("[check:secrets] 确实不交给窗口（只写文件）或属于例外名单时，登记进 scripts/secret-fields-allowlist.json 并写 reason，PR 正文说明理由。");
    return 1;
  }
  console.log(`[check:secrets] ${found.length} 个像密钥的序列化字段，都在白名单里。`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  process.exitCode = main();
}
