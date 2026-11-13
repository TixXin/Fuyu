const MAC_MODIFIERS = new Set(["⌃", "⌥", "⇧", "⌘"]);

export function shortcutKeyCaps(label: string): string[] {
  const text = label.trim();
  if (!text) return [];
  if (/\s\+\s/.test(text)) return text.split(/\s\+\s/).filter(Boolean);
  const caps: string[] = [];
  let rest = text;
  while (rest.length > 1 && MAC_MODIFIERS.has(rest[0])) {
    caps.push(rest[0]);
    rest = rest.slice(1);
  }
  if (caps.length > 0) return [...caps, rest];
  if (text.includes("+") && text !== "+") {
    return text.replace(/\+\+$/, "+\u0000").split("+").filter(Boolean).map((part) => (part === "\u0000" ? "+" : part));
  }
  return [text];
}
