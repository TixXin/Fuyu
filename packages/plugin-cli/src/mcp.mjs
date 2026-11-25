import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

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
  {
    name: "todos_today",
    description: "Today's todos, scheduled todos, and active todo id in Fuyu.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "todo_add",
    description: "Add a todo in Fuyu (requires allowWrite in Local API settings).",
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "Todo title." },
        date: { type: "string", description: "Optional YYYY-MM-DD schedule date." },
        project: { type: "string", description: "Optional project name." },
      },
    },
  },
  {
    name: "todo_update",
    description: "Update a todo's title, completion state, or focus minutes in Fuyu (requires allowWrite).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Todo id." },
        title: { type: "string", description: "New todo title." },
        completed: { type: "boolean", description: "Completion state." },
        addFocusMinutes: { type: "integer", minimum: 1, maximum: 600, description: "Focus minutes to add." },
      },
    },
  },
  {
    name: "todo_delete",
    description: "Delete a todo by id in Fuyu (requires allowWrite).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Todo id." },
      },
    },
  },
  {
    name: "daily_note",
    description: "Today's daily note in Fuyu.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "daily_note_set",
    description: "Replace or append to today's daily note in Fuyu (requires allowWrite).",
    inputSchema: {
      type: "object",
      properties: {
        note: { type: "string", description: "Replace the whole daily note." },
        append: { type: "string", description: "Append a line to the daily note." },
      },
    },
  },
  {
    name: "island_notify",
    description: "Show a temporary notification on the Fuyu island (requires allowNotify).",
    inputSchema: {
      type: "object",
      required: ["source", "title"],
      properties: {
        source: { type: "string", description: "Source id (1-32 lowercase letters, digits, or -)." },
        title: { type: "string", description: "Notification title (max 120 chars)." },
        body: { type: "string", description: "Optional notification body (max 500 chars)." },
        name: { type: "string", description: "Optional display name for the source (max 40 chars)." },
        durationMs: { type: "integer", minimum: 1000, maximum: 30000, description: "Display duration in milliseconds." },
      },
    },
  },
  {
    name: "agent_status_report",
    description: "Report an external AI agent status to the Fuyu island (requires allowWrite).",
    inputSchema: {
      type: "object",
      required: ["source", "phase"],
      properties: {
        source: { type: "string", description: "Source id (1-32 lowercase letters, digits, or -)." },
        phase: { type: "string", enum: ["running", "waiting", "failed", "completed", "idle"] },
        name: { type: "string", description: "Optional display name." },
        title: { type: "string", description: "Optional session title." },
        taskId: { type: "string", description: "Optional task id." },
        host: { type: "string", description: "Optional remote host name." },
        agent: { type: "string", description: "Optional agent provider." },
        cwd: { type: "string", description: "Optional working directory." },
      },
    },
  },
  {
    name: "agent_status_clear",
    description: "Clear an external AI agent status source on the Fuyu island (requires allowWrite).",
    inputSchema: {
      type: "object",
      required: ["source"],
      properties: {
        source: { type: "string", description: "Source id to clear." },
      },
    },
  },
];

export function defaultLocalApiConfigPath({ env = process.env, home = homedir(), platform = process.platform } = {}) {
  if (typeof env.FUYU_HOME === "string" && env.FUYU_HOME.trim()) {
    return join(env.FUYU_HOME.trim(), "local-api.json");
  }
  const candidates = [join(home, ".fuyu", "local-api.json")];
  if (platform === "win32" && env.APPDATA) {
    candidates.push(join(env.APPDATA, "com.tixxin.fuyu", "local-api.json"));
  } else if (platform === "darwin") {
    candidates.push(join(home, "Library", "Application Support", "com.tixxin.fuyu", "local-api.json"));
  } else {
    const configHome = env.XDG_CONFIG_HOME || join(home, ".config");
    candidates.push(join(configHome, "com.tixxin.fuyu", "local-api.json"));
  }
  return candidates.find((file) => existsSync(file)) ?? candidates[0];
}

export function localApiClient(configPath = defaultLocalApiConfigPath(), { fetchImpl = globalThis.fetch } = {}) {
  return async (path, { method = "GET", body } = {}) => {
    if (!existsSync(configPath)) {
      throw new Error(`${configPath} not found. Start Fuyu and turn on its Local API (Settings > Local API).`);
    }
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    const headers = { Authorization: `Bearer ${config.token}` };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json; charset=utf-8";
      init.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetchImpl(`http://127.0.0.1:${config.port}${path}`, init);
    } catch (error) {
      throw new Error(`Could not reach Fuyu at 127.0.0.1:${config.port} (${error.cause?.code ?? error.message}). Is it running with Local API on?`);
    }
    const answer = await response.json().catch(() => ({ ok: false, error: `HTTP ${response.status}` }));
    if (!answer.ok) throw new Error(answer.error ?? `HTTP ${response.status}`);
    return answer.data;
  };
}

function badParams(message) {
  return Object.assign(new Error(message), { code: -32602 });
}

function requireText(args, field) {
  const value = typeof args?.[field] === "string" ? args[field].trim() : "";
  if (!value) throw badParams(`${field} must be a non-empty string`);
  return value;
}

function pickDefined(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source?.[key] !== undefined) out[key] = source[key];
  }
  return out;
}

async function callTool(name, args, request) {
  if (name === "clipboard_history") {
    const limit = Number.isInteger(args.limit) ? Math.min(50, Math.max(1, args.limit)) : 20;
    const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
    const data = await request(`/v1/clipboard?limit=${query ? 50 : limit}`);
    const items = (data.items ?? []).filter((item) => !query || String(item.text).toLowerCase().includes(query)).slice(0, limit);
    return items.map((item) => ({ copiedAt: new Date(item.copiedAt).toISOString(), favorite: item.favorite, truncated: item.truncated, text: item.text }));
  }
  if (name === "todos_today") return request("/v1/todos");
  if (name === "todo_add") {
    const title = requireText(args, "title");
    return request("/v1/todos", { method: "POST", body: { title, ...pickDefined(args, ["date", "project"]) } });
  }
  if (name === "todo_update") {
    const id = encodeURIComponent(requireText(args, "id"));
    const body = pickDefined(args, ["title", "completed", "addFocusMinutes"]);
    if (Object.keys(body).length === 0) throw badParams("todo_update requires at least one of title, completed, addFocusMinutes");
    return request(`/v1/todos/${id}`, { method: "PATCH", body });
  }
  if (name === "todo_delete") {
    const id = encodeURIComponent(requireText(args, "id"));
    return request(`/v1/todos/${id}`, { method: "DELETE" });
  }
  if (name === "daily_note") return request("/v1/note");
  if (name === "daily_note_set") {
    const body = pickDefined(args, ["note", "append"]);
    if (typeof body.note !== "string" && typeof body.append !== "string") {
      throw badParams("daily_note_set requires note or append");
    }
    return request("/v1/note", { method: "PUT", body });
  }
  if (name === "island_notify") {
    const source = requireText(args, "source");
    const title = requireText(args, "title");
    return request("/v1/notify", { method: "POST", body: { source, title, ...pickDefined(args, ["body", "name", "durationMs"]) } });
  }
  if (name === "agent_status_report") {
    const source = encodeURIComponent(requireText(args, "source"));
    const phase = requireText(args, "phase");
    return request(`/v1/agent-status/${source}`, { method: "PUT", body: { phase, ...pickDefined(args, ["name", "title", "taskId", "host", "agent", "cwd"]) } });
  }
  if (name === "agent_status_clear") {
    const source = encodeURIComponent(requireText(args, "source"));
    return request(`/v1/agent-status/${source}`, { method: "DELETE" });
  }
  throw badParams(`Unknown tool: ${name}`);
}

export async function handleMessage(message, request) {
  const { id, method, params = {} } = message;
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  if (id === undefined || id === null) return null;
  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "fuyu", version: "2" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: TOOLS });
    case "tools/call":
      try {
        const result = await callTool(params.name, params.arguments ?? {}, request);
        return reply({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (error) {
        if (error.code === -32602) return { jsonrpc: "2.0", id, error: { code: -32602, message: error.message } };
        return reply({ content: [{ type: "text", text: error.message }], isError: true });
      }
    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

export async function runMcp({ config, input = process.stdin, output = process.stdout, fetchImpl = globalThis.fetch } = {}) {
  const request = localApiClient(config, { fetchImpl });
  const lines = createInterface({ input });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`);
      continue;
    }
    const answer = await handleMessage(message, request);
    if (answer) output.write(`${JSON.stringify(answer)}\n`);
  }
  return 0;
}
