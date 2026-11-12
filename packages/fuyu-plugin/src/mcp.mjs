import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { defaultConfigPath } from "./dev.mjs";

const PROTOCOL_VERSION = "2025-06-18";

export const TOOLS = [
  {
    name: "clipboard_history",
    description: "Recent text entries of the Fuyu clipboard history, newest first. Masked keys come back masked.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, description: "How many entries (default 20)." },
        query: { type: "string", description: "Only entries containing this text (case-insensitive)." },
      },
    },
  },
  { name: "todos_today", description: "Today's todos in Fuyu.", inputSchema: { type: "object", properties: {} } },
  { name: "daily_note", description: "Today's note in Fuyu.", inputSchema: { type: "object", properties: {} } },
];

export function localApiGetter(configPath = defaultConfigPath()) {
  return async (path) => {
    if (!existsSync(configPath)) throw new Error(`${configPath} not found. Start Fuyu and turn on its Local API plugin (Settings > Plugins).`);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    let response;
    try {
      response = await fetch(`http://127.0.0.1:${config.port}${path}`, { headers: { Authorization: `Bearer ${config.token}` } });
    } catch (error) {
      throw new Error(`Could not reach Fuyu at 127.0.0.1:${config.port} (${error.cause?.code ?? error.message}). Is it running with the Local API plugin on?`);
    }
    const answer = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    if (!answer.ok) throw new Error(answer.error ?? `HTTP ${response.status}`);
    return answer.data;
  };
}

async function callTool(name, args, get) {
  if (name === "clipboard_history") {
    const limit = Number.isInteger(args.limit) ? Math.min(50, Math.max(1, args.limit)) : 20;
    const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
    const data = await get(`/v1/clipboard?limit=${query ? 50 : limit}`);
    const items = (data.items ?? []).filter((item) => !query || String(item.text).toLowerCase().includes(query)).slice(0, limit);
    return items.map((item) => ({ copiedAt: new Date(item.copiedAt).toISOString(), favorite: item.favorite, truncated: item.truncated, text: item.text }));
  }
  if (name === "todos_today") return get("/v1/todos");
  if (name === "daily_note") return get("/v1/note");
  throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
}

export async function handleMessage(message, get) {
  const { id, method, params = {} } = message;
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  if (id === undefined || id === null) return null;
  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "fuyu", version: "1" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call":
      try {
        const result = await callTool(params.name, params.arguments ?? {}, get);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        if (error.code === -32602) return { jsonrpc: "2.0", id, error: { code: -32602, message: error.message } };
        return reply({ content: [{ type: "text", text: error.message }], isError: true });
      }
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

export async function runMcp({ config } = {}) {
  const get = localApiGetter(config);
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
      continue;
    }
    const answer = await handleMessage(message, get);
    if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`);
  }
  return 0;
}
