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
