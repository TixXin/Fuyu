# create-fuyu-plugin

Creates a TypeScript plugin for [Fuyu](https://github.com/TixXin/fuyu):

```sh
npm create fuyu-plugin@latest [folder] -- --owner <github-user> --name <name>
```

The project has a host part that uses the timer service `timers/v1`, an island page (`island.page/v1`)
and a settings section (`settings.section/v1`), with `tsconfig.json` and ESLint rules that stop raw
`setTimeout` / `setInterval`, `addEventListener` and injected styles. Every interface it uses is listed
in `fuyu.experimental`, so it loads only from a development folder until the interfaces are settled.

## Names

| | In this repository | On npm |
|---|---|---|
| This package | `@fuyu/create-plugin` (private, `packages/create-plugin`) | `create-fuyu-plugin` 2.0 and later |
| The command line it sets up | `@fuyu/plugin-cli` | `fuyu-plugin` 2.0 and later |
| The old plugin system (before 2026-11) | removed in E36.6.6 | `create-fuyu-plugin` and `fuyu-plugin` 0.x, stopped at 0.7.0 |

From npm the project depends on `fuyu-plugin`. To try changes that are not published yet, run it from a
checkout of this repository: the project's `devDependencies` then link `@fuyu/plugin-base`,
`@fuyu/plugin-services` and `@fuyu/plugin-cli` from that checkout (`file:`):

```sh
node packages/create-plugin/bin/create-fuyu-plugin.mjs ~/my-plugin --owner you --name my-plugin
```

`--fuyu <folder>` links from another checkout. `--help` lists the other options.

Guide for plugin authors: [docs/plugins](https://github.com/TixXin/fuyu/tree/main/docs/plugins). Design of the
command line: [docs/architecture/plugins/v3-cli.md](https://github.com/TixXin/fuyu/blob/main/docs/architecture/plugins/v3-cli.md).
