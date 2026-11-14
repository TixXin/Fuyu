const LIMIT = 200;

function text(arg) {
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function recordLogs(ctx, onLog) {
  const entries = [];
  ctx.logger.exporter({
    levels: { default: 3 },
    export(message) {
      const entry = { at: message.ts, type: message.type, name: message.name, text: message.args.map(text).join(" ") };
      entries.push(entry);
      if (entries.length > LIMIT) entries.shift();
      onLog?.(entry);
    },
  });
  return entries;
}
