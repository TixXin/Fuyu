import { stripTracking } from "./contentKind.ts";

/**
 * "Paste transformed" (C38): local changes to a text entry, run on this computer only. Each says
 * whether it does anything to this text, so the panel can grey out the ones that would not.
 */
export type TransformId =
  | "oneLine" | "trim" | "joinLines" | "upper" | "lower" | "camel" | "snake"
  | "jsonPretty" | "jsonMinify" | "urlEncode" | "urlDecode" | "stripTracking"
  | "halfWidth" | "simplified" | "traditional" | "markdown" | "sortLines" | "dedupeLines";

export type TransformInput = { text: string; html?: string };

/** Why a transform is greyed out: the text is not JSON, has no link, has no formatting, or it changes nothing. */
export type TransformBlock = "notJson" | "noLink" | "noHtml" | "noChange";

export type Transform = {
  id: TransformId;
  /** Runs it; the native ones (Chinese scripts) and HTML → Markdown are given to the caller. */
  run: (input: TransformInput) => string | null;
  block?: (input: TransformInput) => TransformBlock | null;
};

const lines = (text: string) => text.split(/\r?\n/);
const words = (text: string) => text.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function parsesAsJson(text: string) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

// A prompt someone copied along with the command: "$ ", "> ", "PS C:\x> ", "C:\x>".
const PROMPT = /^\s*(?:\$|>|PS [^>\n]*>|[A-Za-z]:\\[^>\n]*>)\s+/;
// A line ending that carries the command on: bash "\", PowerShell "`", cmd "^".
const CONTINUATION = /\s+[\\`^]\s*$/;

/**
 * A shell command copied over several lines, as one line: continued lines and indented or
 * "-option" lines join with a space, other lines are separate commands joined with " && ".
 */
export function flattenCommand(text: string): string {
  const kept = lines(text).map((line) => line.replace(PROMPT, "")).filter((line) => line.trim() !== "");
  let out = "";
  let carry = true;
  for (const line of kept) {
    const continued = CONTINUATION.test(line);
    const body = line.replace(CONTINUATION, "").trim();
    if (out === "") out = body;
    else out += carry || /^\s|^[-|&]/.test(line) ? ` ${body}` : ` && ${body}`;
    carry = continued;
  }
  return out;
}

/** Full-width letters, digits, punctuation and spaces as their ASCII forms. */
export function toHalfWidth(text: string): string {
  return text.replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, " ");
}

const unchanged = (run: (text: string) => string) => (input: TransformInput): TransformBlock | null =>
  run(input.text) === input.text ? "noChange" : null;

function simple(id: TransformId, run: (text: string) => string, extraBlock?: (input: TransformInput) => TransformBlock | null): Transform {
  return { id, run: ({ text }) => run(text), block: (input) => extraBlock?.(input) ?? unchanged(run)(input) };
}

const notJson = ({ text }: TransformInput): TransformBlock | null => (parsesAsJson(text) ? null : "notJson");

export const TRANSFORMS: readonly Transform[] = [
  simple("oneLine", flattenCommand, ({ text }) => (lines(text.trim()).length < 2 ? "noChange" : null)),
  simple("trim", (text) => lines(text).map((line) => line.trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim()),
  simple("joinLines", (text) => lines(text).map((line) => line.trim()).filter(Boolean).join(" ")),
  simple("upper", (text) => text.toUpperCase()),
  simple("lower", (text) => text.toLowerCase()),
  simple("camel", (text) => words(text).map((word, index) => (index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase())).join("")),
  simple("snake", (text) => words(text).map((word) => word.toLowerCase()).join("_")),
  simple("jsonPretty", (text) => JSON.stringify(JSON.parse(text), null, 2), notJson),
  simple("jsonMinify", (text) => JSON.stringify(JSON.parse(text)), notJson),
  simple("urlEncode", (text) => encodeURIComponent(text)),
  simple("urlDecode", (text) => {
    try {
      return decodeURIComponent(text.replace(/\+/g, " "));
    } catch {
      return text;
    }
  }),
  simple("stripTracking", (text) => stripTracking(text), ({ text }) => (/^https?:\/\/\S+$/i.test(text.trim()) ? null : "noLink")),
  simple("halfWidth", toHalfWidth),
  // Windows converts these (LCMapStringEx); the panel asks the native side.
  { id: "simplified", run: () => null, block: ({ text }) => (/[㐀-鿿]/.test(text) ? null : "noChange") },
  { id: "traditional", run: () => null, block: ({ text }) => (/[㐀-鿿]/.test(text) ? null : "noChange") },
  // Needs the HTML parser of the window; see htmlToMarkdown.ts.
  { id: "markdown", run: () => null, block: ({ html }) => (html ? null : "noHtml") },
  simple("sortLines", (text) => lines(text).sort((a, b) => a.localeCompare(b)).join("\n"), ({ text }) => (lines(text.trim()).length < 2 ? "noChange" : null)),
  simple("dedupeLines", (text) => [...new Set(lines(text))].join("\n")),
];

/** Whether a multi-line text looks like a shell command split over lines (for pasting into terminals). */
export function looksLikeSplitCommand(text: string): boolean {
  const all = lines(text.trim());
  return all.length >= 2 && all.length <= 30 && all.slice(0, -1).some((line) => CONTINUATION.test(line));
}
