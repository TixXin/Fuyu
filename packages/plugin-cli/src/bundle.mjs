import * as esbuild from "esbuild";
import { isBuiltin } from "node:module";
import { join } from "node:path";
import { BuildError } from "./errors.mjs";
import { isPackageOrSubpath, sharedPath } from "./shared.mjs";

const ASSET_LOADERS = Object.fromEntries(
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

export async function bundleHost({ dir, entry, output, external, target = "node22" }) {
  const options = { ...common(dir, target), platform: "node", entryPoints: [entry], outfile: join(dir, output), external: external.flatMap((name) => [name, `${name}/*`]) };
  let { result, warnings } = await run(options, output);
  const imports = () => Object.entries(result.metafile.outputs).find(([path]) => path.endsWith(".js"))?.[1].imports ?? [];
  const usesRequire = imports().some((item) => item.external && REQUIRE_KINDS.has(item.kind));
  if (usesRequire) ({ result, warnings } = await run({ ...options, banner: { js: REQUIRE_BANNER } }, output));
  const nodeApis = new Set(imports().filter((item) => item.external).map((item) => builtinName(item.path)).filter(Boolean));
  if (usesRequire) nodeApis.add("module");
  return { code: outputOf(result).text, nodeApis: [...nodeApis].sort(), inputs: Object.keys(result.metafile.inputs).sort(), warnings };
}

function sharedPlugin({ output, shared, packageDepth, appModules }) {
  return {
    name: "fuyu-shared-modules",
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (Object.hasOwn(shared, args.path)) return { path: sharedPath(output, shared[args.path], packageDepth), external: true };
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
    plugins: [sharedPlugin({ output, shared, packageDepth, appModules })],
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
