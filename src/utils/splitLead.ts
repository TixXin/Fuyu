export function splitLead(text: string): [string, string] {
  const trimmed = text.trim();
  const match = /^(.+?(?:[。！？]|[.!?](?=\s)))\s*(.+)$/s.exec(trimmed);
  return match ? [match[1], match[2].trim()] : [trimmed, ""];
}
