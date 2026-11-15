import { statSync } from "node:fs";
import { join } from "node:path";
import { BuildError } from "./errors.mjs";

export const OUTPUT_DIR = "dist";
export const SOURCE_DIR = "src";
export const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs"];

const isFile = (path) => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

function stemOf(output, field) {
  if (!output.startsWith(`${OUTPUT_DIR}/`)) {
    throw new BuildError(`${field} must point into ${OUTPUT_DIR}/, e.g. "${OUTPUT_DIR}/host.js"`, [{ path: field, code: "output", message: `got "${output}"` }]);
  }
  return output.slice(OUTPUT_DIR.length + 1);
}

export function sourceFor(dir, output, field) {
  const stem = stemOf(output, field).replace(/\.m?js$/, "");
  const found = SOURCE_EXTENSIONS.map((extension) => `${SOURCE_DIR}/${stem}${extension}`).filter((path) => isFile(join(dir, path)));
  if (found.length === 0) {
    throw new BuildError(`${field} is "${output}" but there is no ${SOURCE_DIR}/${stem}.ts (or ${SOURCE_EXTENSIONS.slice(1).join(", ")})`, [
      { path: field, code: "source", message: `missing ${SOURCE_DIR}/${stem}.*` },
    ]);
  }
  if (found.length > 1) {
    throw new BuildError(`${field}: more than one source for "${output}": ${found.join(", ")}`, [{ path: field, code: "source", message: "ambiguous source" }]);
  }
  return found[0];
}

export function planEntries(dir, app, appKey = "fuyu") {
  const outputs = new Map();
  const claim = (output, field) => {
    const key = output.toLowerCase();
    if (outputs.has(key)) throw new BuildError(`${field} and ${outputs.get(key)} both build "${output}"`, [{ path: field, code: "duplicate", message: output }]);
    outputs.set(key, field);
  };
  let host = null;
  if (app.host !== undefined) {
    const field = `${appKey}.host`;
    claim(app.host, field);
    host = { output: app.host, source: sourceFor(dir, app.host, field) };
  }
  const clients = Object.keys(app.client ?? {})
    .sort()
    .map((window) => {
      const field = `${appKey}.client.${window}`;
      const output = app.client[window];
      claim(output, field);
      return { window, output, source: sourceFor(dir, output, field) };
    });
  let config = null;
  if (app.config !== undefined && app.config.startsWith(`${OUTPUT_DIR}/`)) {
    const field = `${appKey}.config`;
    claim(app.config, field);
    const source = `${SOURCE_DIR}/${stemOf(app.config, field)}`;
    if (!isFile(join(dir, source))) throw new BuildError(`${field} is "${app.config}" but ${source} does not exist`, [{ path: field, code: "source", message: `missing ${source}` }]);
    config = { output: app.config, source };
  }
  return { host, clients, config };
}
