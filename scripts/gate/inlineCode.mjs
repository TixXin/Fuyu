const CALL = String.raw`[^,()]+(?:\([^()]*\)[^,()]*)?`;
const MODE = String.raw`(?:mode\s*=\s*)?['"][^'"]{0,6}[wax+][^'"]{0,6}['"]`;
const OWNER = /(?:[\w.]+(?:\([^()]*\))?|\))$/;
const WRITERS = {
  python: [
    new RegExp(String.raw`\bopen\(\s*(${CALL}),\s*${MODE}`, "g"),
    new RegExp(String.raw`\bshutil\.(?:copy\w*|move)\(\s*[^,]+,\s*(${CALL})`, "g"),
    new RegExp(String.raw`\bos\.(?:rename|replace)\(\s*[^,]+,\s*(${CALL})`, "g"),
    new RegExp(String.raw`\bos\.(?:remove|unlink)\(\s*(${CALL})`, "g"),
  ],
  node: [
    new RegExp(String.raw`\b(?:writeFileSync|appendFileSync|writeFile|appendFile|rmSync|unlinkSync|createWriteStream)\(\s*(${CALL})`, "g"),
    new RegExp(String.raw`\b(?:renameSync|copyFileSync|cpSync|rename|copyFile)\(\s*[^,]+,\s*(${CALL})`, "g"),
  ],
};
const OWNED = {
  python: [/\.(?:write_text|write_bytes|unlink|touch)\(/g, new RegExp(String.raw`\.open\(\s*${MODE}`, "g")],
  node: [],
};
const BINDINGS = {
  python: [/^[ \t]*(\w+)[ \t]*=(?!=)[ \t]*/gm, /^[ \t]*for[ \t]+(\w+)[^\n]*?[ \t]in[ \t]+/gm],
  node: [/\b(?:const|let|var)[ \t]+(\w+)[ \t]*=(?!=)[ \t]*/g, /\bfor[ \t]*\([ \t]*(?:const|let|var)[ \t]+(\w+)[ \t]+(?:of|in)[ \t]+/g],
};
const TOKEN = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1|[A-Za-z_$][\w$]*/g;
const PATH_LIKE = /^[^\s'"<>|*?]{1,200}$/;
const LIMIT = 60;

function expression(code, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < code.length; i += 1) {
    const c = code[i];
    if (quote) {
      if (c === "\\") i += 1;
      else if (c === quote) quote = null;
    } else if (c === "'" || c === '"' || c === "`") quote = c;
    else if ("([{".includes(c)) depth += 1;
    else if (")]}".includes(c)) {
      if (depth === 0) return code.slice(start, i);
      depth -= 1;
    } else if ((c === "\n" || c === ";") && depth === 0) return code.slice(start, i);
    else if (c === ":" && depth === 0 && /^\s*(\n|$)/.test(code.slice(i + 1, i + 40))) return code.slice(start, i);
  }
  return code.slice(start);
}

function bindings(code, lang) {
  const vars = new Map();
  for (const pattern of BINDINGS[lang]) {
    for (const match of code.matchAll(pattern)) {
      const name = match[1];
      if (!name) continue;
      const list = vars.get(name) ?? [];
      list.push(expression(code, match.index + match[0].length));
      vars.set(name, list);
    }
  }
  return vars;
}

function combine(parts, glue) {
  let results = [""];
  for (const [index, options] of parts.entries()) {
    results = results.flatMap((prefix) => options.map((option) => (index ? prefix + glue + option : option))).slice(0, LIMIT);
  }
  return results;
}

function values(expr, scope, depth = 0) {
  if (depth > 4) return [];
  if (/\bargv\b/.test(expr)) return scope.args;
  const lookup = (name) => (scope.vars.get(name) ?? []).flatMap((bound) => values(bound, scope, depth + 1)).slice(0, LIMIT);
  const fill = (text) => text.replace(/\$?\{([^{}]*)\}/g, (whole, inner) => lookup(inner.trim())[0] ?? ".");
  const parts = [];
  let first = true;
  for (const token of expr.matchAll(TOKEN)) {
    const after = expr.slice(token.index + token[0].length).trimStart()[0];
    const before = expr.slice(0, token.index).trimEnd().at(-1);
    if (token[1]) parts.push([fill(token[2])]);
    else if (after !== "(" && before !== ".") {
      const bound = lookup(token[0]);
      if (bound.length) parts.push(bound);
      else if (first && after !== "." && !scope.vars.has(token[0]) && /[+/,]/.test(after ?? "")) parts.push(["."]);
    }
    first = false;
  }
  if (!parts.length) return [];
  const trimmed = expr.trim();
  if (/^[[{]/.test(trimmed) || (trimmed.startsWith("(") && trimmed.includes(","))) return parts.flat().slice(0, LIMIT);
  const concat = expr.includes("+") && !/\bjoin\(|\bresolve\(/.test(expr);
  return combine(parts, concat ? "" : "/").map((path) => path.replace(/\/{2,}/g, "/"));
}

function literals(code) {
  const found = [];
  for (const token of code.matchAll(TOKEN)) {
    if (token[1] && PATH_LIKE.test(token[2]) && /[/\\]|\.\w{1,5}$/.test(token[2])) found.push(token[2]);
  }
  return found;
}

export function codeWrites(code, lang, args = []) {
  const text = String(code ?? "");
  const scope = { vars: bindings(text, lang), args };
  const found = [];
  let unresolved = false;
  const note = (expr) => {
    const targets = expr === ")" ? [] : values(expr, scope);
    if (targets.length) found.push(...targets);
    else unresolved = true;
  };
  for (const pattern of WRITERS[lang]) for (const match of text.matchAll(pattern)) note(match[1]);
  for (const pattern of OWNED[lang]) {
    for (const match of text.matchAll(pattern)) note(text.slice(Math.max(0, match.index - 200), match.index).match(OWNER)?.[0] ?? ")");
  }
  if (unresolved) found.push(...literals(text), ...args);
  return [...new Set(found)].slice(0, LIMIT * 4);
}

const PATCH_LINES = [/^(?:\+\+\+|---) (?:[ab]\/)?(\S.*?)\s*$/, /^\*\*\* (?:Update|Add|Delete) File: (.+?)\s*$/, /^rename (?:from|to) (.+?)\s*$/, /^\*\*\* Move to: (.+?)\s*$/];

export function patchTargets(text) {
  const found = new Set();
  for (const line of String(text ?? "").split("\n")) {
    for (const pattern of PATCH_LINES) {
      const match = line.replace(/\r$/, "").match(pattern);
      if (match && match[1] !== "/dev/null") found.add(match[1].replace(/\t.*$/, ""));
    }
  }
  return [...found];
}
