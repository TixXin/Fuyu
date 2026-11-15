import { startHost } from "@fuyu/plugin-base/host";
import { PLUGINS, config, resetProbe, workspace } from "./workspace.mjs";

const probe = resetProbe();
const space = workspace({ ...PLUGINS, "plugins.yml": config([{ id: "user", name: "./user.mjs" }, { id: "counter", name: "./counter.mjs" }]) });
const host = await startHost({ dir: space.dir });
await host.settle();
let codegen = "allowed";
try {
  new Function("return 1")();
} catch {
  codegen = "blocked";
}
const status = host.status();
await host.stop();
space.remove();
process.stdout.write(JSON.stringify({ codegen, status, live: probe.live }));
