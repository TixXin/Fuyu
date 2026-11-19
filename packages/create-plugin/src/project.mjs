import { ENGINE, devDependencies } from "./versions.mjs";

export const SLOTS_USED = Object.freeze(["island.page/v1", "settings.section/v1"]);
export const SERVICES_USED = Object.freeze(["clients", "timers/v1"]);
export const EXPERIMENTAL = Object.freeze([]);

export function packageJson(options) {
  const experimental = Array.isArray(options.experimental) ? options.experimental : EXPERIMENTAL;
  const manifest = {
    name: options.packageName,
    version: "0.1.0",
    type: "module",
    description: options.description.en,
    license: "MIT",
    author: options.owner,
    repository: options.repository,
    engines: { fuyu: ENGINE },
    scripts: {
      dev: "fuyu-plugin dev",
      build: "fuyu-plugin build",
      check: "fuyu-plugin check",
      package: "fuyu-plugin pack",
      typecheck: "tsc",
      lint: "eslint .",
    },
    devDependencies: devDependencies(options.checkout, options.sdkVersion),
    fuyu: {
      manifest: 1,
      displayName: options.displayName,
      description: options.description,
      icon: "assets/icon.svg",
      categories: ["productivity"],
      host: "dist/host.js",
      client: { island: "dist/island.js", settings: "dist/settings.js" },
      inject: { required: [...SERVICES_USED] },
      slots: [...SLOTS_USED],
      ...(experimental.length > 0 ? { experimental: [...experimental] } : {}),
    },
  };
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function readme(options) {
  const checkoutNote = options.checkout
    ? `\n\`devDependencies\` link Fuyu's packages from a checkout of [TixXin/fuyu](https://github.com/TixXin/fuyu) (\`file:\` paths).\n`
    : "";
  return `# ${options.displayName.en}

${options.displayName["zh-CN"]}: a [Fuyu](https://github.com/TixXin/fuyu) plugin for plugin platform v3.

It has the three parts a plugin usually has:

| File | Runs in | What it does |
|---|---|---|
| \`src/host.ts\` | the plugin host (Node) | Uses the timer service \`timers/v1\` and sends the timers to the windows every second while one is running (\`ctx.setInterval\`) |
| \`src/island.tsx\` | the island | A page in the slot \`island.page/v1\`: start a countdown, see the timers |
| \`src/settings.tsx\` | the settings window | A section in the slot \`settings.section/v1\`: how many timers, dismiss the finished ones |

\`fuyu.client\` in \`package.json\` tells Fuyu which window loads which built file. \`src/timers.ts\` is shared
by both sides; \`src/styles.css\` is added to the windows by the build.

The first entry of \`fuyu.categories\` is the plugin's main category: the market counts and filters by it,
while search looks at all of them.
${checkoutNote}
## Develop

\`\`\`sh
npm install
npm run typecheck   # tsc
npm run lint        # eslint, with the rules below
npm run dev         # build, register in plugins.yml and rebuild on changes
npm run check       # what the market would stop, without running the plugin
npm run package     # build a signed or unsigned .fuyu archive
\`\`\`

## Rules

Everything a plugin adds must go away when it stops, so the lint rules send you to the managed versions:

- No \`setTimeout\` / \`setInterval\`: use \`ctx.setTimeout\`, \`ctx.setInterval\` or \`ctx.sleep\` in the host part.
  Windows get their updates from the host (\`ctx.host.on\`).
- No \`addEventListener\`: use \`ctx.host.on\`, a service's \`on()\`, or React's event props.
- No \`<style>\`, \`document.head\` or \`adoptedStyleSheets\`: \`import "./styles.css"\` and the build does it.
- Colors, fonts and radius come from the slot's variables (\`--fuyu-plugin-text\`, \`--fuyu-plugin-accent\`, ...).
`;
}

export function license(options) {
  return `MIT License

Copyright (c) ${new Date().getFullYear()} ${options.owner}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

export const GITIGNORE = "node_modules/\nbuild/\ndist/\n";
