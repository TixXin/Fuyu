export type ScreenshotSource = { app: string; title: string | null; url: string | null };

export type AgentMessageText = { source: string };

export function sourceLine(source: ScreenshotSource | null | undefined) {
  if (!source?.app) return null;
  return source.title ? `${source.app} — ${source.title}` : source.app;
}

export function agentMessage(path: string, options: { instruction?: string; source?: ScreenshotSource | null; text: AgentMessageText }) {
  const lines: string[] = [];
  const instruction = options.instruction?.trim();
  if (instruction) lines.push(instruction);
  const from = sourceLine(options.source);
  if (from) {
    lines.push(`${options.text.source}${from}`);
    if (options.source?.url) lines.push(options.source.url);
  }
  if (lines.length === 0) return null;
  lines.push(`"${path}"`);
  return lines.join("\n");
}
