# fuyu-plugin

SDK, command-line tool and mock host for [Fuyu](https://github.com/TixXin/fuyu) plugins. No runtime dependencies; Node.js 20 or later.

```sh
npm create fuyu-plugin@latest     # start a new plugin
npx fuyu-plugin validate          # check fuyu-plugin.json and the folder
npx fuyu-plugin dev               # load the folder into the running island, restart on changes, print the log
npx fuyu-plugin test              # test/*.test.mjs, or a smoke test under the mock host
npx fuyu-plugin pack              # .package/<id>-<version>.zip, byte-for-byte reproducible
npx fuyu-plugin keygen            # once: your signing key; prints the public key for the market submission
npx fuyu-plugin pack --sign       # also <id>-<version>.zip.sig, to attach to the release
npx fuyu-plugin keys rotate       # new key vouched for by the old one; prints the new signingKeys entry
```

Signing is optional, but only signed plugins update by themselves on users' islands, and the island keeps
updates on the key it first saw. Keep the key (`~/.fuyu-plugin/signing.key`, or
`FUYU_PLUGIN_SIGNING_KEY` with the PEM text) backed up: a version signed with another key needs every
user's confirmation.

## MCP server

`fuyu-plugin mcp` runs an MCP server on stdin / stdout that gives AI tools read-only access to the running island through its local API: `clipboard_history` (needs Settings → Clipboard → "Let the local API read the history"), `todos_today` and `daily_note`.

```sh
claude mcp add fuyu -- npx -y fuyu-plugin mcp
```

## SDK

```js
import { createPlugin } from "fuyu-plugin"; // or the single file lib/fuyu.mjs

const plugin = createPlugin();
plugin.onReady((context) => plugin.log(`started by ${context.activationEvent}`));
plugin.onCommand("hello", () => plugin.notify("Hello from a plugin"));
plugin.views.onVisible("main", (visible) => visible && plugin.views.update("main", { items: [{ id: "1", title: "One" }] }));
plugin.onEvent("todos.changed", async () => plugin.status.update("open", `${(await plugin.todos.list()).todos.length} todos`));
```

Plugins usually carry the SDK as one file (`lib/fuyu.mjs`, which `create-fuyu-plugin` copies) so they need nothing installed at run time.

## Mock host

```js
import { startMockHost } from "fuyu-plugin/test";

const host = startMockHost(".", { deny: ["clipboard:read"] });
host.command("hello");
await host.waitFor((state) => state.notifications.length === 1);
await host.stop();
```

Guide (Chinese): [docs/plugins/quickstart.md](https://github.com/TixXin/fuyu/blob/main/docs/plugins/quickstart.md). API reference: [docs/plugins/api.md](https://github.com/TixXin/fuyu/blob/main/docs/plugins/api.md).
