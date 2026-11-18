const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (full, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower in NAMED_ENTITIES) return NAMED_ENTITIES[lower];
    if (lower.startsWith("#x")) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    if (lower.startsWith("#")) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : full;
    }
    return full;
  });
}

export function htmlToPlainText(html: string): string {
  if (!html) return "";
  const stripped = html
    .replace(/<(script|style|head|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote|pre|table|section|article|header|footer)>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(stripped)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \f\v]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function mailCopyableText(
  subject: string,
  content: { content: string; contentType: "text/plain" | "text/html" } | null,
): string {
  if (content) {
    const body = content.contentType === "text/html"
      ? htmlToPlainText(content.content)
      : content.content.replace(/\r\n?/g, "\n").trim();
    if (body) return body;
  }
  return subject.trim();
}

export function notificationCopyableText(title: string, body: string): string {
  const cleanBody = body.trim();
  if (cleanBody) return cleanBody;
  return title.trim();
}
