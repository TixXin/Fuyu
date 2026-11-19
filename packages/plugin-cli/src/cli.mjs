import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { publicKeyOf } from "@fuyu/plugin-market";
import { VERSION, build, realPath } from "./build.mjs";
import { check } from "./check.mjs";
import { dev } from "./dev.mjs";
import { BuildError, formatIssue } from "./errors.mjs";
import { icon } from "./icon.mjs";
import { searchGlyphs } from "./icon/glyphs.mjs";
import { KEY_ENV, generateSigningKey, loadSigningKey } from "./keys.mjs";
import { pack } from "./pack.mjs";
import { reviewSources } from "./review.mjs";
import { preview } from "./preview.mjs";
import { shots } from "./shots.mjs";
import { signCommitAt, signPackageFile } from "./sign.mjs";

const HELP = `Usage: fuyu-plugin <command> [folder] [options]

Commands:
  build [folder]       Build into build/package/: package.json (with nodeApis and builtWith),
                       dist/ (host part for Node, window parts for the browser), assets, README
    --out <folder>       build somewhere else
    --config <file>      build settings as JSON (the market passes its own)
    --official           allow the @fuyu scope (official plugins only)
  pack [folder]        Build, then write build/<scope>-<name>-<version>.fuyu (same bytes every time)
    --out <file>         write the package somewhere else
    --sign               add your author signature to the package
    --key <file>         the signing key (see keygen)
    --config, --official as for build
  check [folder]       Check without running the plugin: the manifest, a trial build and the
                       review scan the market runs
    --market             check as the market does (no experimental interfaces)
    --strict             listing warnings (screenshots, description, names) count as errors
    --json               print the result as JSON
  icon [folder]        Write the plugin icon (assets/icon.svg): a tinted rounded tile with a line
                       glyph in the same colour, as official plugins have
    --glyph <name>       a lucide icon name (https://lucide.dev/icons), or an .svg file you drew
    --color <#rrggbb>    the plugin's colour
    --out <file>         write somewhere else (default: the manifest's icon, else assets/icon.svg)
    --search <word>      list lucide icon names that contain the word, then exit
  preview [folder]     Draw the market card and the detail page of this plugin, dark and light,
                       in one HTML file
    --out <file>         where the page goes (default: build/preview.html)
    --theme <dark|light> --locale <zh-CN|en>
                         only this theme or language (default: both)
    --png                also save each view as a PNG, in a headless Chrome or Edge
    --open               open the page in the browser
  shots [folder]       Screenshot the island page and the collapsed item with the sample in
                       shots/sample.ts, in a headless Chrome or Edge, and compose a cover
    --out <folder>       where the images go (default: screenshots/)
    --sample <file>      use this sample instead of shots/sample.ts
    --theme <dark|light>, --locale <zh-CN|en>
                         for shots that do not say (default: dark, zh-CN)
    --color <#rrggbb>    the cover's colour (default: the icon's tile colour)
    --no-cover           skip cover.png
    --scale <1|2|3>      pixels per point (default 2)
  review <old> <new>   Compare two versions like the market review. Each side is a folder or a
                       git commit; the old side is - for a first release
    --repo <folder>      git repository for commits (default: the current folder)
    --path <folder>      the plugin's folder inside it (default: the current folder's place)
    --old-built <folder>, --new-built <folder>
                         build outputs to scan as well
    --format <markdown|json>, --json <file>, --markdown <file>
  keygen               Create your signing key once and print the public key for the market.
                       Same key file as fuyu-plugin 1.x, so an existing key is reused
    --key <file>         where the key goes
  sign [folder]        Sign a commit for the market submission (fuyu-plugin-commit/1)
    --commit <rev>       the commit (default HEAD)
    --repository <url>   default: package.json's repository as https://github.com/<owner>/<repo>
    --key <file>, --out <file>
  sign <file.fuyu>     Add your author signature to a package
    --key <file>, --out <file>
  dev [folder]         Build, register in plugins.yml as source: dev, and rebuild on changes
    --data-dir <folder>  plugin host data directory containing plugins.yml
    --once               build and register once without watching
    --clean              remove the dev entry from plugins.yml
  version, help

The signing key comes from --key, else ${KEY_ENV} (the PEM text), else ~/.fuyu-plugin/signing.key.
Exit codes: 0 done, 1 errors (or a red review), 2 bad arguments.`;

const COMMON = { help: { type: "boolean", short: "h" } };
const BUILD = { config: { type: "string" }, official: { type: "boolean" } };
const OPTIONS = {
  build: { ...BUILD, out: { type: "string" } },
  pack: { ...BUILD, out: { type: "string" }, sign: { type: "boolean" }, key: { type: "string" } },
  check: { ...BUILD, market: { type: "boolean" }, strict: { type: "boolean" }, json: { type: "boolean" } },
  icon: { glyph: { type: "string" }, color: { type: "string" }, out: { type: "string" }, search: { type: "string" } },
  preview: { out: { type: "string" }, theme: { type: "string" }, locale: { type: "string" }, png: { type: "boolean" }, open: { type: "boolean" } },
  shots: { out: { type: "string" }, sample: { type: "string" }, theme: { type: "string" }, locale: { type: "string" }, color: { type: "string" }, "no-cover": { type: "boolean" }, scale: { type: "string" } },
  review: {
    repo: { type: "string" },
    path: { type: "string" },
    "old-built": { type: "string" },
    "new-built": { type: "string" },
    format: { type: "string", default: "markdown" },
    json: { type: "string" },
    markdown: { type: "string" },
  },
  keygen: { key: { type: "string" } },
  sign: { key: { type: "string" }, out: { type: "string" }, commit: { type: "string" }, repository: { type: "string" } },
  dev: { ...BUILD, out: { type: "string" }, "data-dir": { type: "string" }, once: { type: "boolean" }, clean: { type: "boolean" } },
};
const CONFIG_KEYS = ["shared", "hostExternal", "appModules", "packageDepth", "nodeTarget", "browserTarget"];

class UsageError extends Error {}

function readConfig(file, cwd) {
  if (!file) return {};
  const config = JSON.parse(readFileSync(resolve(cwd, file), "utf8"));
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new UsageError(`${file} must hold a JSON object`);
  const unknown = Object.keys(config).filter((key) => !CONFIG_KEYS.includes(key));
  if (unknown.length) throw new UsageError(`${file}: unknown settings ${unknown.join(", ")} (known: ${CONFIG_KEYS.join(", ")})`);
  return config;
}

function createOutput(io, cwd) {
  const base = realPath(cwd);
  const show = (path) => {
    const rel = relative(base, realPath(path));
    return rel && !rel.startsWith("..") ? rel : path;
  };
  return {
    show,
    out: (text) => io.stdout.write(`${text}\n`),
    warn: (issue) => io.stderr.write(`warning: ${formatIssue(issue)}\n`),
    error: (issue) => io.stderr.write(`error: ${typeof issue === "string" ? issue : formatIssue(issue)}\n`),
  };
}

function buildOptions(values, cwd) {
  return { ...readConfig(values.config, cwd), official: Boolean(values.official) };
}

function signingKey(values, io) {
  return loadSigningKey({ file: values.key ? resolve(io.cwd, values.key) : undefined, env: io.env }).privateKey;
}

const commands = {
  async build({ values, positionals }, io, out) {
    const result = await build(resolve(io.cwd, positionals[0] ?? "."), { ...buildOptions(values, io.cwd), outDir: values.out ? resolve(io.cwd, values.out) : undefined });
    result.warnings.forEach(out.warn);
    out.out(`built ${result.manifest.name} ${result.manifest.version} into ${out.show(result.outDir)}`);
    out.out(`  nodeApis: ${result.nodeApis.join(", ") || "(none)"}`);
    out.out(`  files: ${result.files.join(", ")}`);
    return 0;
  },

  async pack({ values, positionals }, io, out) {
    const privateKey = values.sign ? signingKey(values, io) : undefined;
    const result = await pack(resolve(io.cwd, positionals[0] ?? "."), { ...buildOptions(values, io.cwd), file: values.out ? resolve(io.cwd, values.out) : undefined, signingKey: privateKey });
    result.warnings.forEach(out.warn);
    out.out(`packed ${out.show(result.file)} (${result.size} bytes)`);
    out.out(`  digest: ${result.digest}`);
    out.out(`  sha256: ${result.sha256}`);
    if (result.signedBy) out.out(`  signed by ${result.signedBy}`);
    return 0;
  },

  async check({ values, positionals }, io, out) {
    const result = await check(resolve(io.cwd, positionals[0] ?? "."), { ...buildOptions(values, io.cwd), allowExperimental: !values.market, listing: values.strict ? "error" : "warn" });
    if (values.json) {
      out.out(JSON.stringify({ ok: result.ok, errors: result.errors, warnings: result.warnings }, null, 2));
      return result.ok ? 0 : 1;
    }
    result.errors.forEach(out.error);
    result.warnings.forEach(out.warn);
    out.out(result.ok ? `ok${result.warnings.length ? ` with ${result.warnings.length} warning(s)` : ""}` : `${result.errors.length} error(s)`);
    return result.ok ? 0 : 1;
  },

  async icon({ values, positionals }, io, out) {
    if (values.search !== undefined) {
      const names = await searchGlyphs(values.search);
      if (names.length === 0) out.error(`no lucide icon name contains "${values.search}"`);
      else out.out(names.join("\n"));
      return names.length === 0 ? 1 : 0;
    }
    if (!values.glyph || !values.color) throw new UsageError("icon needs --glyph <lucide name | file.svg> and --color <#rrggbb>");
    const dir = resolve(io.cwd, positionals[0] ?? ".");
    const glyph = values.glyph.toLowerCase().endsWith(".svg") ? resolve(io.cwd, values.glyph) : values.glyph;
    const result = await icon(dir, { glyph, color: values.color, out: values.out ? resolve(io.cwd, values.out) : undefined });
    result.notes.forEach(out.warn);
    out.out(`${result.replaced ? "replaced" : "wrote"} ${out.show(result.file)} (${result.glyph}, ${result.color})`);
    return 0;
  },

  async preview({ values, positionals }, io, out) {
    const result = await preview(resolve(io.cwd, positionals[0] ?? "."), {
      out: values.out ? resolve(io.cwd, values.out) : undefined,
      theme: values.theme,
      locale: values.locale,
      png: values.png,
      open: values.open,
      env: io.env,
    });
    [...result.warnings, ...result.listing].forEach(out.warn);
    out.out(`wrote ${out.show(result.file)} (${result.stages.map((stage) => `${stage.theme} ${stage.locale}`).join(", ")})`);
    for (const image of result.images) out.out(`wrote ${out.show(image.file)}`);
    return 0;
  },

  async shots({ values, positionals }, io, out) {
    const result = await shots(resolve(io.cwd, positionals[0] ?? "."), {
      outDir: values.out ? resolve(io.cwd, values.out) : undefined,
      sample: values.sample ? resolve(io.cwd, values.sample) : undefined,
      theme: values.theme,
      locale: values.locale,
      color: values.color,
      cover: !values["no-cover"],
      scale: values.scale === undefined ? undefined : Number(values.scale),
      env: io.env,
    });
    result.warnings.forEach(out.warn);
    for (const shot of result.files) out.out(`wrote ${out.show(shot.file)} (${shot.width}x${shot.height}, ${shot.slot}, ${shot.theme}, ${shot.locale})`);
    if (result.cover) out.out(`wrote ${out.show(result.cover.file)} (${result.cover.width}x${result.cover.height}, cover from ${result.cover.from} on ${result.cover.color})`);
    if (!result.sample) out.out("no shots/sample.ts: the plugin was captured without data");
    return 0;
  },

  async review({ values, positionals }, io, out) {
    if (positionals.length !== 2) throw new UsageError("review needs two versions: <old folder | commit | -> <new folder | commit>");
    if (!["markdown", "json"].includes(values.format)) throw new UsageError("--format is markdown or json");
    const { report, markdown } = reviewSources({
      oldSpec: positionals[0],
      newSpec: positionals[1],
      repo: resolve(io.cwd, values.repo ?? "."),
      path: values.path,
      oldBuilt: values["old-built"] ? resolve(io.cwd, values["old-built"]) : null,
      newBuilt: values["new-built"] ? resolve(io.cwd, values["new-built"]) : null,
    });
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (values.json) writeFileSync(resolve(io.cwd, values.json), json);
    if (values.markdown) writeFileSync(resolve(io.cwd, values.markdown), markdown);
    io.stdout.write(values.format === "json" ? json : markdown);
    return report.tier === "red" ? 1 : 0;
  },

  async keygen({ values }, io, out) {
    const file = values.key ? resolve(io.cwd, values.key) : undefined;
    try {
      const key = generateSigningKey({ file });
      io.stderr.write(`created ${key.file}; back it up: updates signed by another key need every user's confirmation\n`);
      out.out(JSON.stringify({ keyId: key.keyId, publicKey: key.publicKey }, null, 2));
    } catch (error) {
      if (error?.code !== "exists") throw error;
      const { privateKey } = loadSigningKey({ file: error.file, env: {} });
      io.stderr.write(`${error.file} already exists; its public key:\n`);
      out.out(JSON.stringify(publicKeyOf(privateKey), null, 2));
    }
    return 0;
  },

  async sign({ values, positionals }, io, out) {
    const target = positionals[0] ?? ".";
    const privateKey = signingKey(values, io);
    if (target.toLowerCase().endsWith(".fuyu")) {
      const result = signPackageFile(resolve(io.cwd, target), privateKey, values.out ? resolve(io.cwd, values.out) : undefined);
      out.out(`signed ${out.show(result.file)} (${result.name} ${result.version}) with ${result.keyId}`);
      return 0;
    }
    const signed = signCommitAt(resolve(io.cwd, target), privateKey, { commit: values.commit, repository: values.repository });
    const json = `${JSON.stringify(signed, null, 2)}\n`;
    if (values.out) writeFileSync(resolve(io.cwd, values.out), json);
    io.stdout.write(json);
    return 0;
  },

  async dev({ values, positionals }, io, out) {
    const dir = resolve(io.cwd, positionals[0] ?? ".");
    const dataDir = values["data-dir"] ? resolve(io.cwd, values["data-dir"]) : io.env.FUYU_PLUGINS_V3_DIR;
    if (values.clean) {
      const cleaned = await dev(dir, { dataDir, cleanOnly: true });
      out.out(`removed dev entry ${cleaned.id} from ${out.show(cleaned.ymlFile)}`);
      return 0;
    }
    const session = await dev(dir, {
      ...buildOptions(values, io.cwd),
      outDir: values.out ? resolve(io.cwd, values.out) : undefined,
      dataDir,
      once: Boolean(values.once),
      onRebuild: (res) => out.out(`rebuilt ${res.manifest.name} ${res.manifest.version}`),
      onError: (err) => out.error(err instanceof Error ? err.message : String(err)),
    });
    session.result.warnings.forEach(out.warn);
    out.out(`dev ${session.id} -> ${out.show(session.result.outDir)} (registered in ${out.show(session.ymlFile)})`);
    return 0;
  },
};

export async function run(argv, io = {}) {
  const env = io.env ?? process.env;
  const context = { stdout: io.stdout ?? process.stdout, stderr: io.stderr ?? process.stderr, cwd: io.cwd ?? process.cwd(), env };
  const out = createOutput(context, context.cwd);
  const [command = "help", ...rest] = argv;
  if (command === "help" || command === "--help" || command === "-h") {
    out.out(HELP);
    return 0;
  }
  if (command === "version" || command === "--version") {
    out.out(VERSION);
    return 0;
  }
  if (!Object.hasOwn(commands, command)) {
    out.error(`unknown command "${command}"\n\n${HELP}`);
    return 2;
  }
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: { ...COMMON, ...OPTIONS[command] }, allowPositionals: true, strict: true });
  } catch (error) {
    out.error(`${error instanceof Error ? error.message : String(error)}\n\n${HELP}`);
    return 2;
  }
  if (parsed.values.help) {
    out.out(HELP);
    return 0;
  }
  try {
    return await commands[command](parsed, context, out);
  } catch (error) {
    if (error instanceof UsageError) {
      out.error(error.message);
      return 2;
    }
    if (error instanceof BuildError) {
      out.error(error.message);
      error.issues.forEach(out.error);
      return 1;
    }
    out.error(error instanceof Error ? error.message : String(error));
    (error?.issues ?? []).forEach(out.error);
    return 1;
  }
}
