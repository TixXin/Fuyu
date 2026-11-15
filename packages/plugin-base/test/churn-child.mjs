import { startHost } from "@fuyu/plugin-base/host";
import { PLUGINS, config, resetProbe, until, workspace } from "./workspace.mjs";

const rounds = Number(process.argv[2] ?? 1000);
const probe = resetProbe();
const space = workspace({ ...PLUGINS, "plugins.yml": config([{ id: "counter", name: "./counter.mjs" }, { id: "user", name: "./user.mjs" }]) });
const host = await startHost({ dir: space.dir });
await host.settle();
const user = [...host.ctx.loader.entries()].find((entry) => entry.options.id === "user");

function snapshot() {
  globalThis.gc();
  globalThis.gc();
  const resources = {};
  for (const kind of process.getActiveResourcesInfo()) resources[kind] = (resources[kind] ?? 0) + 1;
  const memory = process.memoryUsage();
  return { resources, heap: memory.heapUsed, external: memory.external + memory.arrayBuffers, rss: memory.rss };
}

for (let round = 0; round < 50; round += 1) {
  await user.update({ disabled: true });
  await user.update({ disabled: false });
}
await until(() => probe.applied === 51);
const before = snapshot();
for (let round = 0; round < rounds; round += 1) {
  await user.update({ disabled: true });
  await user.update({ disabled: false });
}
await until(() => probe.applied === 51 + rounds);
const after = snapshot();
const result = { rounds, applied: probe.applied, cleaned: probe.cleaned, live: probe.live, before, after };
await host.stop();
result.stopped = { live: probe.live, resources: snapshot().resources };
space.remove();
process.stdout.write(JSON.stringify(result));
