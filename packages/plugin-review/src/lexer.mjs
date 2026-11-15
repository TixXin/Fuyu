const REGEX_AFTER = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_AFTER_WORDS = /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

function decodeEscape(text, index) {
  const next = text[index + 1];
  const simple = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };
  if (next === undefined) return { value: "", length: 1 };
  if (next in simple && !(next === "0" && /\d/.test(text[index + 2] ?? ""))) return { value: simple[next], length: 2 };
  if (next === "x") {
    const hex = text.slice(index + 2, index + 4);
    if (/^[0-9a-fA-F]{2}$/.test(hex)) return { value: String.fromCharCode(parseInt(hex, 16)), length: 4 };
  }
  if (next === "u") {
    if (text[index + 2] === "{") {
      const end = text.indexOf("}", index + 3);
      const hex = end > 0 ? text.slice(index + 3, end) : "";
      if (/^[0-9a-fA-F]{1,6}$/.test(hex) && parseInt(hex, 16) <= 0x10ffff) {
        return { value: String.fromCodePoint(parseInt(hex, 16)), length: end - index + 1 };
      }
    }
    const hex = text.slice(index + 2, index + 6);
    if (/^[0-9a-fA-F]{4}$/.test(hex)) return { value: String.fromCharCode(parseInt(hex, 16)), length: 6 };
  }
  if (next === "\r" && text[index + 2] === "\n") return { value: "", length: 3 };
  if (next === "\n" || next === "\r") return { value: "", length: 2 };
  return { value: next, length: 2 };
}

function lastSignificant(out) {
  let end = out.length - 1;
  while (end >= 0 && /\s/.test(out[end])) end -= 1;
  if (end < 0) return "";
  if (/[\w$]/.test(out[end])) {
    let start = end;
    while (start > 0 && /[\w$]/.test(out[start - 1])) start -= 1;
    return out.slice(start, end + 1).join("");
  }
  return out[end];
}

export function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === "\n") starts.push(i + 1);
  return starts;
}

export function lineAt(starts, offset) {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= offset) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}

export function lex(text) {
  const masked = [];
  const stripped = [];
  const strings = [];
  const templateStack = [];
  let i = 0;

  const keep = (char) => {
    masked.push(char);
    stripped.push(char);
  };
  const blank = (char, keepInStripped) => {
    const space = char === "\n" ? "\n" : " ";
    masked.push(space);
    stripped.push(keepInStripped ? char : space);
  };

  const readQuoted = (quote) => {
    const start = i;
    let value = "";
    keep(quote);
    i += 1;
    while (i < text.length && text[i] !== quote && text[i] !== "\n") {
      if (text[i] === "\\") {
        const escape = decodeEscape(text, i);
        for (let k = 0; k < escape.length && i + k < text.length; k += 1) blank(text[i + k], true);
        value += escape.value;
        i += escape.length;
      } else {
        value += text[i];
        blank(text[i], true);
        i += 1;
      }
    }
    if (i < text.length && text[i] === quote) {
      keep(quote);
      i += 1;
    }
    strings.push({ start, end: i, value, quote, template: false, parts: [value] });
  };

  const readTemplate = (resume) => {
    let entry = resume;
    if (!entry) {
      entry = { start: i, end: i, value: "", quote: "`", template: true, parts: [""], expressions: 0 };
      strings.push(entry);
      keep("`");
      i += 1;
    }
    while (i < text.length) {
      const char = text[i];
      if (char === "`") {
        keep("`");
        i += 1;
        entry.end = i;
        entry.value = entry.parts.join("${}");
        return;
      }
      if (char === "$" && text[i + 1] === "{") {
        keep("$");
        keep("{");
        i += 2;
        entry.expressions += 1;
        entry.parts.push("");
        templateStack.push({ entry, depth: 0 });
        return;
      }
      if (char === "\\") {
        const escape = decodeEscape(text, i);
        for (let k = 0; k < escape.length && i + k < text.length; k += 1) blank(text[i + k], true);
        entry.parts[entry.parts.length - 1] += escape.value;
        i += escape.length;
        continue;
      }
      entry.parts[entry.parts.length - 1] += char;
      blank(char, true);
      i += 1;
    }
    entry.end = i;
    entry.value = entry.parts.join("${}");
  };

  const readRegex = () => {
    let inClass = false;
    blank(text[i], true);
    i += 1;
    while (i < text.length && text[i] !== "\n") {
      const char = text[i];
      if (char === "\\") {
        blank(char, true);
        if (i + 1 < text.length) blank(text[i + 1], true);
        i += 2;
        continue;
      }
      blank(char, true);
      i += 1;
      if (char === "[") inClass = true;
      else if (char === "]") inClass = false;
      else if (char === "/" && !inClass) break;
    }
    while (i < text.length && /[a-z]/.test(text[i])) keep(text[i++]);
  };

  while (i < text.length) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") blank(text[i++], false);
      continue;
    }
    if (char === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end < 0 ? text.length : end + 2;
      while (i < stop) blank(text[i++], false);
      continue;
    }
    if (char === "'" || char === '"') {
      readQuoted(char);
      continue;
    }
    if (char === "`") {
      readTemplate(null);
      continue;
    }
    if (char === "/") {
      const previous = lastSignificant(masked);
      if (REGEX_AFTER.has(previous) || REGEX_AFTER_WORDS.test(previous)) {
        readRegex();
        continue;
      }
    }
    const top = templateStack[templateStack.length - 1];
    if (top && char === "{") top.depth += 1;
    if (top && char === "}") {
      if (top.depth === 0) {
        templateStack.pop();
        keep("}");
        i += 1;
        readTemplate(top.entry);
        continue;
      }
      top.depth -= 1;
    }
    keep(char);
    i += 1;
  }
  return { masked: masked.join(""), stripped: stripped.join(""), strings };
}
