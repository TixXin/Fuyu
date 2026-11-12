export type ApprovalPreview = {
  kind: "command" | "file" | "url" | "input";
  text: string;
  note: string | null;
};

const MAX_INPUT_CHARS = 600;

const FILE_KEYS = ["file_path", "notebook_path", "path"];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function commandText(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value.filter((part): part is string => typeof part === "string");
    return parts.length ? parts.join(" ") : null;
  }
  return text(value);
}

export function approvalPreview(toolInput: unknown): ApprovalPreview {
  const input = record(toolInput);
  const note = text(input.description);
  const command = commandText(input.command) ?? commandText(input.cmd);
  if (command) return { kind: "command", text: command, note };
  for (const key of FILE_KEYS) {
    const file = text(input[key]);
    if (file) return { kind: "file", text: file, note };
  }
  const url = text(input.url) ?? text(input.query);
  if (url) return { kind: "url", text: url, note };
  let raw: string;
  try {
    raw = JSON.stringify(toolInput) ?? "";
  } catch {
    raw = String(toolInput);
  }
  return { kind: "input", text: raw.length > MAX_INPUT_CHARS ? `${raw.slice(0, MAX_INPUT_CHARS)}…` : raw, note };
}

export function alwaysAllowRule(suggestions: unknown[] | null | undefined): string | null {
  for (const suggestion of suggestions ?? []) {
    const entry = record(suggestion);
    if (entry.type !== "addRules" || !Array.isArray(entry.rules)) continue;
    const rule = record(entry.rules[0]);
    const tool = text(rule.toolName);
    if (!tool) continue;
    const content = text(rule.ruleContent);
    return content ? `${tool}(${content})` : tool;
  }
  return null;
}
