import * as esbuild from "esbuild";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { ASSET_LOADERS, resolveServicesFallback } from "../bundle.mjs";
import { SOURCE_EXTENSIONS } from "../entries.mjs";
import { BuildError } from "../errors.mjs";
import { MAIN_JS, PRELUDE_JS } from "./harness.mjs";

export const SAMPLE_DIR = "shots";
export const SAMPLE_NAME = "sample";
const SAMPLE_EXTENSIONS = [...SOURCE_EXTENSIONS, ".json"];
const REACT = /^react(?:-dom)?(?:\/.*)?$/;
const SERVICES = /^(?:@fuyu\/plugin-services|fuyu-plugin\/services|@fuyu\/plugin-base\/services)$/;

export function findSample(dir) {
  const found = SAMPLE_EXTENSIONS.map((extension) => join(dir, SAMPLE_DIR, `${SAMPLE_NAME}${extension}`)).filter((file) => existsSync(file));
  if (found.length > 1) throw new BuildError(`more than one sample file in ${SAMPLE_DIR}/: keep one of ${found.map((file) => file.slice(dir.length + 1)).join(", ")}`);
  return found[0] ?? null;
}

function reactRoot(dir) {
  const has = (base) => {
    try {
      const require = createRequire(join(base, "package.json"));
      require.resolve("react/package.json");
      require.resolve("react-dom/package.json");
      return true;
    } catch {
      return false;
    }
  };
  if (has(dir)) return dir;
  const own = dirname(import.meta.dirname);
  if (has(own)) return own;
  throw new BuildError("shots needs react and react-dom to render the plugin's components; install them in the plugin project: npm install --save-dev react react-dom");
}

function shotsPlugin({ dir, client, sample }) {
  const base = reactRoot(dir);
  return {
    name: "fuyu-shots",
    setup(build) {
      build.onResolve({ filter: /^fuyu-shots:/ }, (args) => {
        if (args.path === "fuyu-shots:client") return { path: client };
        if (args.path === "fuyu-shots:sample" && sample) return { path: sample };
        return { path: args.path.slice("fuyu-shots:".length), namespace: "fuyu-shots" };
      });
      build.onLoad({ filter: /.*/, namespace: "fuyu-shots" }, (args) => {
        if (args.path === "prelude") return { contents: PRELUDE_JS, loader: "js", resolveDir: dir };
        if (args.path === "sample") return { contents: "export default {};\n", loader: "js" };
        return { errors: [{ text: `unknown module fuyu-shots:${args.path}` }] };
      });
      build.onResolve({ filter: REACT }, (args) => {
        if (args.pluginData?.fuyuShots) return undefined;
        return build.resolve(args.path, { resolveDir: base, kind: args.kind, pluginData: { fuyuShots: true } });
      });
      build.onResolve({ filter: SERVICES }, (args) => resolveServicesFallback(dir, args.path));
    },
  };
}

function issuesOf(messages) {
  return messages.map((message) => ({ file: message.location?.file, line: message.location?.line, column: message.location ? message.location.column + 1 : undefined, message: message.text, code: "esbuild" }));
}

export async function bundleShots({ dir, client, sample, target = "es2022" }) {
  let result;
  try {
    result = await esbuild.build({
      absWorkingDir: dir,
      bundle: true,
      format: "iife",
      platform: "browser",
      target,
      write: false,
      outdir: join(dir, "fuyu-shots-out"),
      logLevel: "silent",
      charset: "utf8",
      sourcemap: false,
      minify: false,
      tsconfigRaw: {},
      jsx: "automatic",
      loader: ASSET_LOADERS,
      define: { "process.env.NODE_ENV": '"production"' },
      stdin: { contents: MAIN_JS, resolveDir: dir, sourcefile: "fuyu-shots-main.js", loader: "js" },
      plugins: [shotsPlugin({ dir, client, sample })],
    });
  } catch (error) {
    if (Array.isArray(error?.errors)) throw new BuildError("the screenshot page failed to build", issuesOf(error.errors));
    throw error;
  }
  return {
    js: result.outputFiles.find((file) => file.path.endsWith(".js"))?.text ?? "",
    css: result.outputFiles.find((file) => file.path.endsWith(".css"))?.text ?? "",
    warnings: issuesOf(result.warnings),
  };
}
