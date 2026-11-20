export type Inline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "heading"; level: number; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; content: Inline[] }
  | { type: "code"; text: string }
  | { type: "table"; align: TableAlign[]; head: Inline[][]; rows: Inline[][][] }
  | { type: "rule" };

export type TableAlign = "left" | "center" | "right" | null;

export type MarkdownOptions = { emphasis?: boolean; breaks?: boolean; autolink?: boolean };

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(!?\[[^\]]*\]\([^)\s]+\))/g;
const INLINE_NO_EM = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(?!)()|(!?\[[^\]]*\]\([^)\s]+\))/g;
const BARE_URL = /https?:\/\/[^\s<>()"'\u0080-\uffff]*[^\s<>()"'\u0080-\uffff.,;:!?]/gi;

export function linkify(text: string): Inline[] {
  const result: Inline[] = [];
  let at = 0;
  for (const match of text.matchAll(BARE_URL)) {
    const start = match.index ?? 0;
    if (start > at) result.push({ type: "text", text: text.slice(at, start) });
    result.push({ type: "link", text: match[0], href: match[0] });
    at = start + match[0].length;
  }
  if (at < text.length) result.push({ type: "text", text: text.slice(at) });
  return result;
}

export function parseInline(text: string, options: MarkdownOptions = {}): Inline[] {
  const result: Inline[] = [];
  const pushText = (value: string) => {
    if (!value) return;
    for (const part of options.autolink ? linkify(value) : [{ type: "text", text: value } as const]) {
      const last = result[result.length - 1];
      if (part.type === "text" && last?.type === "text") last.text += part.text;
      else result.push({ ...part });
    }
  };
  let at = 0;
  for (const match of text.matchAll(options.emphasis === false ? INLINE_NO_EM : INLINE)) {
    pushText(text.slice(at, match.index));
    const [token, code, strong, em, link] = match;
    if (code) result.push({ type: "code", text: code.slice(1, -1) });
    else if (strong) result.push({ type: "strong", text: strong.slice(2, -2) });
    else if (em) result.push({ type: "em", text: em.slice(1, -1) });
    else if (link) {
      const image = link.startsWith("!");
      const [, label = "", href = ""] = /^!?\[([^\]]*)\]\(([^)\s]+)\)$/.exec(link) ?? [];
      if (!image && /^https?:\/\//i.test(href)) result.push({ type: "link", text: label || href, href });
      else pushText(label);
    } else pushText(token);
    at = (match.index ?? 0) + token.length;
  }
  pushText(text.slice(at));
  return result;
}

const LIST_ITEM = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/;
const TABLE_DELIMITER = /^:?-+:?$/;
const BLOCK_START = /^(?:```|#{1,6}\s|>)/;

export function tableCells(line: string): string[] {
  const cells: string[] = [];
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

export function tableAlign(line: string, columns: number): TableAlign[] | null {
  if (!line.includes("-")) return null;
  const cells = tableCells(line);
  if (cells.length !== columns || !cells.every((cell) => TABLE_DELIMITER.test(cell))) return null;
  return cells.map((cell) => (cell.startsWith(":") && cell.endsWith(":") ? "center" : cell.endsWith(":") ? "right" : cell.startsWith(":") ? "left" : null));
}

export function parseMarkdown(source: string, options: MarkdownOptions = {}): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  const joiner = options.breaks ? "\n" : " ";
  const inline = (text: string) => parseInline(text, options);
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", content: inline(paragraph.join(joiner)) });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flush();
      const code: string[] = [];
      for (index += 1; index < lines.length && !lines[index].trim().startsWith("```"); index += 1) code.push(lines[index]);
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }
    if (!trimmed) { flush(); continue; }
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(trimmed);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length, content: inline(heading[2]) });
      continue;
    }
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed.replace(/\s/g, ""))) { flush(); blocks.push({ type: "rule" }); continue; }
    if (trimmed.startsWith(">")) {
      flush();
      const quote: string[] = [];
      for (; index < lines.length && lines[index].trim().startsWith(">"); index += 1) quote.push(lines[index].trim().replace(/^>\s?/, ""));
      index -= 1;
      blocks.push({ type: "quote", content: inline(quote.join(joiner)) });
      continue;
    }
    if (trimmed.includes("|") && index + 1 < lines.length) {
      const head = tableCells(trimmed);
      const align = tableAlign(lines[index + 1].trim(), head.length);
      if (align) {
        flush();
        const rows: string[][] = [];
        for (index += 2; index < lines.length; index += 1) {
          const row = lines[index].trim();
          if (!row.includes("|") || BLOCK_START.test(row) || LIST_ITEM.test(lines[index])) break;
          const cells = tableCells(row).slice(0, head.length);
          rows.push([...cells, ...Array<string>(head.length - cells.length).fill("")]);
        }
        index -= 1;
        blocks.push({ type: "table", align, head: head.map(inline), rows: rows.map((row) => row.map(inline)) });
        continue;
      }
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      const ordered = item[2] !== undefined;
      const items: string[] = [];
      for (; index < lines.length; index += 1) {
        const next = LIST_ITEM.exec(lines[index]);
        if (next && (next[2] !== undefined) === ordered) items.push(next[3]);
        else if (items.length > 0 && /^\s{2,}\S/.test(lines[index])) items[items.length - 1] += ` ${lines[index].trim()}`;
        else break;
      }
      index -= 1;
      blocks.push({ type: "list", ordered, items: items.map(inline) });
      continue;
    }
    paragraph.push(trimmed);
  }
  flush();
  return blocks;
}
