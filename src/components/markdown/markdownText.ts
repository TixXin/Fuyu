import { tableAlign, tableCells } from "./parseMarkdown.ts";

const STRONG = /\*\*[^*\n]+\*\*/;
const LINK = /\[[^\]\n]+\]\(https?:\/\/[^)\s]+\)/;
const FENCE = /^\s*```/m;
const HEADING = /^#{1,6}\s+\S/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+\S/;
const DELIMITER_ROW = /^[\s|:-]+$/;

function hasTable(lines: string[]): boolean {
  for (let index = 0; index + 1 < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.includes("|") && tableAlign(lines[index + 1].trim(), tableCells(line).length)) return true;
  }
  return false;
}

export function looksLikeMarkdown(text: string): boolean {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (hasTable(lines) || STRONG.test(text) || LINK.test(text) || FENCE.test(text)) return true;
  const filled = lines.map((line) => line.trim()).filter(Boolean);
  if (filled.length < 3) return false;
  return filled.filter((line) => HEADING.test(line) || LIST_ITEM.test(line)).length >= 2;
}

function plainLine(line: string): string {
  return line.trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^>\s?/, "")
    .replace(/^(?:[-*+]|\d+[.)])\s+/, "")
    .replace(/^```.*$/, "")
    .replace(/^\||\|$/g, "")
    .replace(/\s*(?<!\\)\|\s*/g, " · ")
    .replace(/\\\|/g, "|")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, strong, under) => strong ?? under)
    .replace(/!?\[([^\]]*)\]\([^)\s]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function markdownToPlainLine(text: string): string {
  if (!looksLikeMarkdown(text)) return text;
  return text.replace(/\r\n?/g, "\n").split("\n")
    .filter((line) => !(DELIMITER_ROW.test(line) && line.includes("-")))
    .map(plainLine)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
