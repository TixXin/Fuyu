import { Context, Service } from "@fuyu/plugin-base";
import { PACKAGES_DIR, SERVICE_CALLS, dataDirOf, readBuiltins, readManifest, serviceError, startHost, type BuiltinCatalog, type Host, type PluginPackage, type PluginStatus, type ServiceEntry, type ServicesApi } from "@fuyu/plugin-base/host";

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

const offered: ServiceEntry[] = host.services();
const stopWatching: () => void = host.watchServices((list) => list.map((entry) => entry.name.length));
const detach: () => void = host.serviceHub.attachWindows({ connected: () => ["main"], publish: () => {} });
void host.serviceHub.windowCall("service.call", { service: "timers/v1", method: "list" }, "main");
// @ts-expect-error only the three service calls go to the hub
void host.serviceHub.windowCall("plugin.call", {}, "main");
const failed: string = serviceError("not-ready", "no provider").code;
const known: boolean = SERVICE_CALLS.has("service.on");
declare const services: ServicesApi;
const echo = { name: "demo.echo/v1", methods: { echo: {} }, events: { said: {} } } as const;
const handle = services.provide(echo, { echo: (params, caller) => ({ params, window: caller.window ?? null }) });
const delivered: boolean = handle.emit("said", { at: 1 });
const reply: Promise<unknown> = services.get(echo).echo({ text: "hi" });
void services.get(echo).on("said", () => {});
void offered;
void stopWatching;
void detach;
void failed;
void known;
void delivered;
void reply;

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

const withBuiltins: Host = await startHost({ dir: "/tmp", builtins: "/app/builtins", dataDir: "/tmp/data" });
const builtinKinds: ("essential" | "builtin")[] = withBuiltins.builtins().map((entry) => entry.kind);
const catalog: BuiltinCatalog = readBuiltins("/app/builtins");
const folder: string = dataDirOf("/tmp/data", catalog.plugins[0]?.id ?? "timer");
void builtinKinds;
void folder;

const sourced: Host = await startHost({ dir: "/tmp", appVersion: "0.6.0" });
const sources: (string | undefined)[] = sourced.status().map((entry) => entry.source);
const undeclared: string[] | undefined = sourced.status()[0]?.undeclared?.provides;
const manifestErrors = sourced.status().flatMap((entry) => (entry.blocked?.by === "manifest" ? entry.blocked.errors.map((issue) => issue.code) : []));
const installed: PluginPackage = readManifest(`/tmp/${PACKAGES_DIR}/@ann/weather`, { allowExperimental: false, appVersion: "0.6.0" });
const windows: string[] = installed.clients.map((client) => client.window);
void sources;
void undeclared;
void manifestErrors;
void windows;
