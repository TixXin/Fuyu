import { resolve } from "node:path";
import { runMcp } from "./mcp.mjs";

export { TOOLS as MCP_TOOLS, defaultLocalApiConfigPath, handleMessage as handleMcpMessage, localApiClient, runMcp } from "./mcp.mjs";

export const APP_COMMANDS = Object.freeze({
  mcp: Object.freeze({
    help: ["  mcp                  Serve Fuyu's Local API over stdio as an MCP server", "    --config <file>      path to local-api.json"],
    options: { config: { type: "string" } },
    run({ values }, io) {
      const config = values.config ? resolve(io.cwd, values.config) : undefined;
      return runMcp({ config, input: io.stdin ?? process.stdin, output: io.stdout });
    },
  }),
});
