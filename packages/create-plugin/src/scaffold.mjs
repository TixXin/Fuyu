import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { checkPluginName, parseRepository } from "@fuyu/plugin-manifest";
import { GITIGNORE, license, packageJson, readme } from "./project.mjs";
import { findCheckout } from "./versions.mjs";

export const TEMPLATE_DIR = fileURLToPath(new URL("../template/", import.meta.url));
const NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;

export function nameProblem(name) {
  return NAME.test(name) ? null : "lowercase letters, digits, '.', '-' and '_', starting with a letter or digit";
}

export function ownerProblem(owner) {
  return OWNER.test(owner) ? null : "a GitHub user or organization name: letters, digits and single '-'";
}

function words(name) {
  const text = name.replace(/[._-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cssPrefix(name) {
  const ident = name.replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return /^[a-z]/.test(ident) ? ident : `plugin-${ident}`;
}

export function normalizeOptions(input = {}) {
  const owner = (input.owner ?? "").trim();
  const ownerIssue = ownerProblem(owner);
  if (ownerIssue) throw new Error(`The owner "${owner}" is not valid: ${ownerIssue}.`);
  const name = (input.name ?? "my-plugin").trim();
  const nameIssue = nameProblem(name);
  if (nameIssue) throw new Error(`The name "${name}" is not valid: ${nameIssue}.`);
  const repository = (input.repository ?? `github:${owner}/${name}`).trim();
  if (!parseRepository(repository)) throw new Error(`The repository "${repository}" does not name a source repository (e.g. github:${owner}/${name}).`);
  const packageName = `@${owner.toLowerCase()}/${name}`;
  const problem = checkPluginName(packageName, repository);
  if (problem) throw new Error(problem.message);
  const en = (input.displayName ?? "").trim() || words(name);
  const zh = (input.displayNameZh ?? "").trim() || en;
  return {
    owner,
    name,
    packageName,
    repository,
    displayName: { "zh-CN": zh, en },
    description: { "zh-CN": `${zh}：浮屿插件`, en: `${en}: a Fuyu plugin` },
    css: cssPrefix(name),
    checkout: findCheckout(input.fuyu),
    dir: resolve(input.dir ?? name),
  };
}

function templateFiles(dir = TEMPLATE_DIR) {
  const walk = (folder) =>
    readdirSync(folder, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((entry) => (entry.isDirectory() ? walk(join(folder, entry.name)) : [join(folder, entry.name)]));
  return walk(dir).map((file) => [relative(dir, file).split(sep).join("/"), readFileSync(file, "utf8")]);
}

export function fillTemplate(text, options) {
  const quoted = (value) => JSON.stringify(value).slice(1, -1);
  const values = { name: options.name, css: options.css, displayNameEn: quoted(options.displayName.en), displayNameZh: quoted(options.displayName["zh-CN"]) };
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}

export function projectFiles(options) {
  const files = new Map(templateFiles().map(([path, text]) => [path, fillTemplate(text, options)]));
  files.set("package.json", packageJson(options));
  files.set("README.md", readme(options));
  files.set("LICENSE", license(options));
  files.set(".gitignore", GITIGNORE);
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b)));
}

export function scaffold(input) {
  const options = normalizeOptions(input);
  if (existsSync(options.dir) && readdirSync(options.dir).length > 0) throw new Error(`${options.dir} is not empty.`);
  const written = [];
  for (const [path, text] of projectFiles(options)) {
    const target = join(options.dir, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    written.push(path);
  }
  return { options, written };
}
