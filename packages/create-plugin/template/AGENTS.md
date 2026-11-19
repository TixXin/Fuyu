# AGENTS.md

For AI coding agents working on this [Fuyu](https://github.com/TixXin/fuyu) plugin. The project starts as a working
example (a timer page); replace it with what the user asked for.

**Done means:** `npm run typecheck`, `npm run lint` and `npm run check` finish without errors, `npm run dev` has
registered the plugin with the running Fuyu, and you have told the user what the plugin reads, writes and connects
to. You cannot see the island, so also tell the user where the plugin shows up and what to check there.

## A plugin has the same access as Fuyu

There is no permission list and no sandbox: the host part is plain Node code. So stay inside the request. Don't read
files, run programs or contact hosts the feature does not need, don't touch anything outside this folder, and never
put secrets in the source. Finish with a short list of what the plugin reads, writes and which hosts it contacts,
because the user decides from that list whether to keep it.

## Parts

Each part is optional; delete the ones the plugin does not need, together with their `package.json` entries.

| Source | Runs in | Declared in `package.json` |
|---|---|---|
| `src/host.ts` | Fuyu's plugin process (Node): background logic, services, files, network | `fuyu.host: "dist/host.js"` |
| `src/island.tsx` | the island window (React) | `fuyu.client.island: "dist/island.js"` |
| `src/settings.tsx` | the settings window (React) | `fuyu.client.settings: "dist/settings.js"` |

The manifest names built files; the build finds the source by path (`dist/x.js` comes from `src/x.ts` or `.tsx`).
Windows cannot use Node. A window asks the host with `ctx.host.call(method)` and listens with `ctx.host.on(topic)`;
the host answers with `ctx.clients.handle(method, handler)` and sends with `ctx.clients.publish(topic, data)`.

Node's built-in modules (`node:fs`, `node:path`, …) have no types until you add them: run
`npm install -D @types/node` and put `/// <reference types="node" />` on the first line of `src/host.ts`. Don't
declare the modules by hand and don't add `node` to `types` in `tsconfig.json`.

## Look names up, never guess them

Only the services, slots and `ctx` members in the reference exist. A made-up service name leaves the plugin waiting
forever, and a made-up slot fails when the plugin loads, so the build will not catch it for you.

- Services, extension points, slots and theme variables:
  https://github.com/TixXin/fuyu/blob/main/docs/plugins/services-and-slots.md
- Exact signatures: follow the imports in `src/host.ts` to the type declarations in `node_modules`.
- Manifest fields: https://github.com/TixXin/fuyu/blob/main/docs/plugins/package.md
- Command line (`dev`, `check`, `pack`): https://github.com/TixXin/fuyu/blob/main/docs/plugins/cli.md
- A worked example, from an empty project to a page that stores data:
  https://github.com/TixXin/fuyu/blob/main/docs/plugins/first-plugin.md
- Finished plugins to copy patterns from (weather, pomodoro, world clock, GitHub issues):
  https://github.com/TixXin/fuyu/tree/main/plugins/v3/official

## Declarations must match the code

Fuyu, the build and the market compare `package.json` with what the code does, and flag a plugin that differs.

- A service used in the host: its name in `export const inject` in `src/host.ts` **and** in `fuyu.inject.required`
  (or `optional`). A plugin whose required service is missing does not start; it waits.
- A slot filled with `ctx.slots.add`: its name in `fuyu.slots`. A slot belongs to one window (`island.*` only in
  `src/island.tsx`).
- A host contacted: its domain in `fuyu.network`. Make the request with `fetch` in the host part, not in a window.
- A `ctx` member other than the ones the example uses (`ctx.commands`, `ctx.settings`, `ctx.island`, …): its name in
  `inject` and in `fuyu.inject` too, as the reference shows for each.
- Remove what the example declares and you no longer use (`timers/v1`, a slot, a client file).
- `fuyu.nodeApis` is written by the build; don't add it yourself.

The example's identity has to go too: `fuyu.displayName` and `fuyu.description` in both languages (the top-level
`description` equals the English one), `README.md`, and the icon (`npx fuyu-plugin icon --glyph <lucide name>
--color <#rrggbb>`).

## Everything the plugin adds must go away when it stops

Users switch plugins on and off without restarting Fuyu, so the lint rules send you to the managed versions:

- No `setTimeout` / `setInterval`: `ctx.setTimeout`, `ctx.setInterval`, `ctx.sleep` in the host. A window has no
  timers, so anything that changes with time (a clock, a countdown, a count that resets at midnight) is worked out
  in the host and sent with `ctx.clients.publish`.
- No `addEventListener`: `ctx.host.on`, a service's `on()`, or React event props.
- No `<style>`, `document.head` or `adoptedStyleSheets`: `import "./styles.css"` and the build adds it.

## Interface

- Every visible string in Chinese and English, the way `src/text.ts` does it. Titles in the manifest and in slots
  take `{ "zh-CN": "…", "en": "…" }`.
- Colors, font and radius come from the slot's variables (`--fuyu-plugin-text`, `--fuyu-plugin-surface`,
  `--fuyu-plugin-accent`, …), so the plugin fits both the dark and the light island. No hard-coded colors.
- The island is small. A page is a compact panel, an item on the collapsed bar is a few characters wide; put the
  most important reading first, and don't use `width: 100%` or `flex: 1` in a collapsed-bar item.
- Prefix every CSS class with the plugin's name, as `src/styles.css` does: plugin styles share the window with Fuyu.

## Settings and data

- Settings: keep them in `config.json` under `ctx.dataDir` and edit them in a `settings.section/v1` section, the
  way the official weather plugin does. Only that file follows the user to their other devices and into backups.
  If the plugin is empty until something is set (a city, a repository), report it with
  `ctx.settings.setup?.({ needed, hint })`.
- Other data (caches, history): other files under `ctx.dataDir`, nowhere else.

## Work loop

```sh
npm install
npm run dev         # builds, registers the plugin with the running Fuyu, rebuilds on every change
npm run typecheck
npm run lint
npm run check       # what the market would stop
```

`npm run check` ends with `ok with N warning(s)` on a fresh project: that is a pass. Warnings starting with
`review:` or `listing:` matter only when publishing to the market.

`npm run dev` keeps running; start it in the background. Fuyu must be running for the plugin to show up. Open the
island to see an island page; errors are in Fuyu's Settings → Plugins, on the plugin's row. If you cannot run
commands, give the user the files and these commands to run themselves.
