#!/usr/bin/env node
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const OUT = fileURLToPath(new URL("../src/icon/lucide.json", import.meta.url));
const NOTICE = fileURLToPath(new URL("../src/icon/LUCIDE-LICENSE", import.meta.url));
const NODE = /const __iconNode = (\[[\s\S]*?\]);\n/;
const ALIAS = /export \{ default \} from '\.\/([a-z0-9-]+)\.mjs';/;

function markup(nodes) {
  return nodes
    .map(([tag, attrs]) => {
      const pairs = Object.entries(attrs).filter(([name]) => name !== "key");
      return `<${tag}${pairs.map(([name, value]) => ` ${name}="${value}"`).join("")}/>`;
    })
    .join("");
}

export function readLucide(from = fileURLToPath(new URL("../../../package.json", import.meta.url))) {
  const require = createRequire(from);
  const root = dirname(require.resolve("lucide-react/package.json"));
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const dir = join(root, "dist", "esm", "icons");
  const icons = {};
  const aliases = {};
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".mjs") || file === "index.mjs") continue;
    const text = readFileSync(join(dir, file), "utf8");
    const match = NODE.exec(text);
    if (match) icons[file.slice(0, -4)] = markup(runInNewContext(match[1]));
    else if (ALIAS.test(text)) aliases[file.slice(0, -4)] = ALIAS.exec(text)[1];
  }
  return { version, icons, aliases, license: join(root, "LICENSE") };
}

export function serialize({ version, icons, aliases }) {
  const block = (entries) => Object.entries(entries).map(([name, value]) => `    ${JSON.stringify(name)}: ${JSON.stringify(value)}`).join(",\n");
  return `{\n  "source": "lucide-react",\n  "version": ${JSON.stringify(version)},\n  "license": "ISC, see LUCIDE-LICENSE",\n  "icons": {\n${block(icons)}\n  },\n  "aliases": {\n${block(aliases)}\n  }\n}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const data = readLucide();
  writeFileSync(OUT, serialize(data));
  copyFileSync(data.license, NOTICE);
  console.log(`wrote ${Object.keys(data.icons).length} icons from lucide-react ${data.version}`);
}
