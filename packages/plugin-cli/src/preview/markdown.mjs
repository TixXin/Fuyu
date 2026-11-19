const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(!?\[[^\]]*\]\([^)\s]+\))/g;
const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const HEADINGS = ["h3", "h4", "h5", "h6", "h6", "h6"];
const TABLE_DELIMITER = /^:?-+:?$/;
const BLOCK_START = /^(?:```|#{1,6}\s|>)/;

function tableCells(line) {
  const cells = [];
  let cell = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\\" && line[index + 1] === "|") {
      cell += "|";
      index += 1;
    } else if (char === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += char;
  }
  cells.push(cell.trim());
  if (cells[0] === "") cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

function tableAlign(line, columns) {
  if (!line.includes("-")) return null;
  const cells = tableCells(line);
  if (cells.length !== columns || !cells.every((cell) => TABLE_DELIMITER.test(cell))) return null;
  return cells.map((cell) => (cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : null));
}

function tableHtml(align, head, rows) {
  const cell = (tag, text, column) => `<${tag}${align[column] ? ` data-align="${align[column]}"` : ""}>${inlineHtml(text)}</${tag}>`;
  const body = rows.map((row) => `<tr>${row.map((text, column) => cell("td", text, column)).join("")}</tr>`).join("");
  return `<div class="markdown__table"><table><thead><tr>${head.map((text, column) => cell("th", text, column)).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function inlineHtml(text) {
  let html = "";
  let at = 0;
  for (const match of text.matchAll(INLINE)) {
    html += escapeHtml(text.slice(at, match.index));
    const [token, code, strong, em, link] = match;
    if (code) html += `<code>${escapeHtml(code.slice(1, -1))}</code>`;
    else if (strong) html += `<strong>${escapeHtml(strong.slice(2, -2))}</strong>`;
    else if (em) html += `<em>${escapeHtml(em.slice(1, -1))}</em>`;
    else if (link) {
      const [, label = "", href = ""] = /^!?\[([^\]]*)\]\(([^)\s]+)\)$/.exec(link) ?? [];
      if (!link.startsWith("!") && /^https?:\/\//i.test(href)) html += `<a href="${escapeHtml(href)}" rel="noreferrer">${escapeHtml(label || href)}</a>`;
      else html += escapeHtml(label);
    } else html += escapeHtml(token);
    at = match.index + token.length;
  }
  return html + escapeHtml(text.slice(at));
}

export function markdownHtml(source) {
  const lines = String(source).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push(`<p>${inlineHtml(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flush();
      const code = [];
      for (index += 1; index < lines.length && !lines[index].trim().startsWith("```"); index += 1) code.push(lines[index]);
      blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(trimmed);
    if (heading) {
      flush();
      const tag = HEADINGS[heading[1].length - 1];
      blocks.push(`<${tag}>${inlineHtml(heading[2])}</${tag}>`);
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed.replace(/\s/g, ""))) {
      flush();
      blocks.push("<hr>");
      continue;
    }
    if (trimmed.startsWith(">")) {
      flush();
      const quote = [];
      for (; index < lines.length && lines[index].trim().startsWith(">"); index += 1) quote.push(lines[index].trim().replace(/^>\s?/, ""));
      index -= 1;
      blocks.push(`<blockquote>${inlineHtml(quote.join(" "))}</blockquote>`);
      continue;
    }
    if (trimmed.includes("|") && index + 1 < lines.length) {
      const head = tableCells(trimmed);
      const align = tableAlign(lines[index + 1].trim(), head.length);
      if (align) {
        flush();
        const rows = [];
        for (index += 2; index < lines.length; index += 1) {
          const row = lines[index].trim();
          if (!row.includes("|") || BLOCK_START.test(row) || LIST_ITEM.test(lines[index])) break;
          const cells = tableCells(row).slice(0, head.length);
          rows.push([...cells, ...Array(head.length - cells.length).fill("")]);
        }
        index -= 1;
        blocks.push(tableHtml(align, head, rows));
        continue;
      }
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      const ordered = item[2] !== undefined;
      const items = [];
      for (; index < lines.length; index += 1) {
        const next = LIST_ITEM.exec(lines[index]);
        if (next && (next[2] !== undefined) === ordered) items.push(next[3]);
        else if (items.length > 0 && /^\s{2,}\S/.test(lines[index])) items[items.length - 1] += ` ${lines[index].trim()}`;
        else break;
      }
      index -= 1;
      const tag = ordered ? "ol" : "ul";
      blocks.push(`<${tag}>${items.map((entry) => `<li>${inlineHtml(entry)}</li>`).join("")}</${tag}>`);
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks.join("\n");
}
