import { Context, Service } from "@fuyu/plugin-base";
import { startHost, type Host, type PluginStatus } from "@fuyu/plugin-base/host";

class Counter extends Service {
  value = 0;
  constructor(ctx: Context) {
    super(ctx, "counter");
  }
}

const host: Host = await startHost({ dir: "/tmp", watch: true, onLog: (entry) => entry.text });
const states: PluginStatus["state"][] = host.status().map((entry) => entry.state);
void Counter;
void states;

import { connectHost, type HostConnection } from "@fuyu/plugin-base/client";
import { CLOSE, WINDOW_ORIGINS } from "@fuyu/plugin-base/protocol";

const connection: HostConnection = connectHost<{ plugins: PluginStatus[] }>({
  resolve: async () => ({ port: 1, token: "t" }),
  window: "main",
  onSnapshot: (snapshot) => snapshot.plugins.length,
});
const code: 4401 = CLOSE.badToken;
void connection;
void code;
void WINDOW_ORIGINS;
