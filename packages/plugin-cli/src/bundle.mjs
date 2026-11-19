import * as esbuild from "esbuild";
import { existsSync, readFileSync } from "node:fs";
import { isBuiltin } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BuildError } from "./errors.mjs";
import { isPackageOrSubpath, sharedPath } from "./shared.mjs";

const CLI_SRC_DIR = dirname(fileURLToPath(import.meta.url));
const BUILTIN_SERVICES_CANDIDATES = [
  join(CLI_SRC_DIR, "services.mjs"),
  join(CLI_SRC_DIR, "..", "..", "plugin-services", "src", "index.mjs"),
];
const BUILTIN_BASE_SERVICES_CANDIDATES = [
  join(CLI_SRC_DIR, "services.mjs"),
  join(CLI_SRC_DIR, "..", "..", "plugin-base", "src", "services.mjs"),
];

function hasLocalServices(dir, specifier) {
  if (specifier === "@fuyu/plugin-services") return existsSync(join(dir, "node_modules", "@fuyu", "plugin-services"));
  if (specifier === "@fuyu/plugin-base/services") return existsSync(join(dir, "node_modules", "@fuyu", "plugin-base"));
  const manifestFile = join(dir, "node_modules", "fuyu-plugin", "package.json");
  if (!existsSync(manifestFile)) return false;
  try {
    return Boolean(JSON.parse(readFileSync(manifestFile, "utf8"))?.exports?.["./services"]);
  } catch {
    return false;
  }
}

export function resolveServicesFallback(dir, specifier) {
  if (hasLocalServices(dir, specifier)) return undefined;
  const candidates = specifier === "@fuyu/plugin-base/services" ? BUILTIN_BASE_SERVICES_CANDIDATES : BUILTIN_SERVICES_CANDIDATES;
  const found = candidates.find((candidate) => existsSync(candidate));
  return found ? { path: found } : undefined;
}

export const ASSET_LOADERS = Object.fromEntries(
  [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".wav", ".ogg"].map((extension) => [extension, "dataurl"]),
);
const REQUIRE_KINDS = new Set(["require-call", "require-resolve"]);
const REQUIRE_BANNER = 'import { createRequire as __fuyuCreateRequire } from "node:module";\nconst require = __fuyuCreateRequire(import.meta.url);';
const STYLES_MODULE = "fuyu-plugin:styles";

export function builtinName(specifier) {
  if (!isBuiltin(specifier)) return null;
  const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  return bare.split("/")[0];
}

function common(dir, target) {
  return {
    absWorkingDir: dir,
    bundle: true,
    format: "esm",
    target,
    write: false,
    metafile: true,
    logLevel: "silent",
    charset: "utf8",
    sourcemap: false,
    minify: false,
    tsconfigRaw: {},
    jsx: "automatic",
    loader: ASSET_LOADERS,
  };
}

function issuesOf(messages) {
  return messages.map((message) => ({
    file: message.location?.file,
    line: message.location?.line,
    column: message.location ? message.location.column + 1 : undefined,
    message: message.text,
    code: "esbuild",
  }));
}

async function run(options, label) {
  try {
    const result = await esbuild.build(options);
    return { result, warnings: issuesOf(result.warnings) };
  } catch (error) {
    if (Array.isArray(error?.errors)) throw new BuildError(`${label} failed to build`, issuesOf(error.errors));
    throw error;
  }
}

const outputOf = (result) => result.outputFiles.find((file) => !file.path.endsWith(".css"));

function exactly(names) {
  return new RegExp(`^(?:${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`);
}

function hostSharedPlugin(names, dir) {
  const filter = names.length ? exactly(names) : null;
  return {
    name: "fuyu-host-shared",
    setup(build) {
      if (filter) build.onResolve({ filter }, (args) => ({ path: args.path, external: true }));
      build.onResolve({ filter: /^(?:@fuyu\/plugin-services|fuyu-plugin\/services)$/ }, (args) => resolveServicesFallback(dir, args.path));
    },
  };
}

export async function bundleHost({ dir, entry, output, external, target = "node22" }) {
  const plugins = [hostSharedPlugin(external, dir)];
  const options = { ...common(dir, target), platform: "node", entryPoints: [entry], outfile: join(dir, output), plugins };
  let { result, warnings } = await run(options, output);
  const imports = () => Object.entries(result.metafile.outputs).find(([path]) => path.endsWith(".js"))?.[1].imports ?? [];
  const usesRequire = imports().some((item) => item.external && REQUIRE_KINDS.has(item.kind));
  if (usesRequire) ({ result, warnings } = await run({ ...options, banner: { js: REQUIRE_BANNER } }, output));
  const nodeApis = new Set(imports().filter((item) => item.external).map((item) => builtinName(item.path)).filter(Boolean));
  if (usesRequire) nodeApis.add("module");
  return { code: outputOf(result).text, nodeApis: [...nodeApis].sort(), inputs: Object.keys(result.metafile.inputs).sort(), warnings };
}

function sharedPlugin({ dir, output, shared, packageDepth, appModules }) {
  return {
    name: "fuyu-shared-modules",
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (Object.hasOwn(shared, args.path)) return { path: sharedPath(output, shared[args.path], packageDepth), external: true };
        if (args.path === "fuyu-plugin/services" || args.path === "@fuyu/plugin-services" || args.path === "@fuyu/plugin-base/services") {
          return resolveServicesFallback(dir, args.path);
        }
        const owner = appModules.find((name) => isPackageOrSubpath(args.path, name));
        if (owner) return { errors: [{ text: `"${args.path}" is provided by the app, but window code cannot import it yet (shared modules: ${Object.keys(shared).join(", ")})` }] };
        return undefined;
      });
      build.onResolve({ filter: /^fuyu-plugin:styles$/ }, () => ({ path: "styles", namespace: "fuyu-plugin" }));
    },
  };
}

function stylesWrapper(entry, plugin) {
  return [
    `import plugin from ${JSON.stringify(`./${entry}`)};`,
    `import css from ${JSON.stringify(STYLES_MODULE)};`,
    'const apply = typeof plugin === "function" ? plugin : plugin.apply;',
    "export default function applyWithStyles(ctx) {",
    "  ctx.effect(() => {",
    '    const style = document.createElement("style");',
    `    style.dataset.fuyuPlugin = ${JSON.stringify(plugin)};`,
    "    style.textContent = css;",
    "    document.head.append(style);",
    "    return () => style.remove();",
    '  }, "styles");',
    "  return apply.call(plugin, ctx);",
    "}",
    "",
  ].join("\n");
}

export async function bundleClient({ dir, entry, output, plugin, shared, packageDepth, appModules, target = "es2022" }) {
  const base = {
    ...common(dir, target),
    platform: "browser",
    outfile: join(dir, output),
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [sharedPlugin({ dir, output, shared, packageDepth, appModules })],
  };
  const first = await run({ ...base, entryPoints: [entry] }, output);
  const css = first.result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "";
  if (!css) return { code: outputOf(first.result).text, css: "", inputs: Object.keys(first.result.metafile.inputs).sort(), warnings: first.warnings };
  const styles = {
    name: "fuyu-styles",
    setup(build) {
      build.onLoad({ filter: /.*/, namespace: "fuyu-plugin" }, () => ({ contents: `export default ${JSON.stringify(css)};\n`, loader: "js" }));
    },
  };
  const second = await run(
    {
      ...base,
      plugins: [...base.plugins, styles],
      stdin: { contents: stylesWrapper(entry, plugin), resolveDir: dir, sourcefile: "fuyu-client-styles.js", loader: "js" },
    },
    output,
  );
  return { code: outputOf(second.result).text, css, inputs: Object.keys(first.result.metafile.inputs).sort(), warnings: first.warnings };
}
