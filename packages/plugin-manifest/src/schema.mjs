import { DEFAULT_APP_KEY, DEFAULT_CATEGORIES, MANIFEST_VERSION, MAX_SCREENSHOTS, PLATFORMS, REQUIRED_LOCALES } from "./manifest.mjs";

const text = { type: "string", minLength: 1 };
const list = (items = text) => ({ type: "array", items, uniqueItems: true });
const path = { type: "string", minLength: 1, pattern: "^(?![A-Za-z]:)(?!/)(?!.*\\\\)(?!(?:.*/)?\\.\\.?(?:/|$)).+$" };
const localized = {
  type: "object",
  required: REQUIRED_LOCALES,
  properties: Object.fromEntries(REQUIRED_LOCALES.map((locale) => [locale, text])),
  additionalProperties: { type: "string" },
};

export function manifestSchema({ appKey = DEFAULT_APP_KEY, categories = DEFAULT_CATEGORIES } = {}) {
  const app = {
    type: "object",
    required: ["manifest", "displayName", "description", "icon", "categories"],
    properties: {
      manifest: { const: MANIFEST_VERSION },
      displayName: localized,
      description: localized,
      icon: { ...path, pattern: `${path.pattern.slice(0, -1)}\\.(?:png|svg)$` },
      categories: { ...list({ enum: categories }), minItems: 1 },
      screenshots: {
        type: "array",
        maxItems: MAX_SCREENSHOTS,
        items: { type: "object", required: ["path"], properties: { path, caption: localized } },
      },
      preview: { type: "boolean" },
      platforms: list({ enum: PLATFORMS }),
      host: path,
      client: { type: "object", additionalProperties: path },
      inject: { type: "object", properties: { required: list(), optional: list() } },
      requires: { type: "object", propertyNames: { pattern: "^@[^/]+/[^/]+$" }, additionalProperties: text },
      provides: list(),
      replaces: list(),
      slots: list(),
      commands: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title"],
          properties: { id: text, title: localized, keybinding: text },
        },
      },
      network: list({ type: "string", pattern: "^(?:\\*\\.)?[a-z0-9.-]+$" }),
      config: path,
      experimental: list(),
      nodeApis: { ...list(), description: "Written by the build: the Node modules the host part imports" },
      builtWith: { type: "string", description: "Written by the build: the SDK version" },
    },
  };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `${appKey} plugin package.json`,
    type: "object",
    required: ["name", "version", "type", "license", "repository", "engines", appKey],
    properties: {
      name: { type: "string", pattern: "^@[a-z0-9][a-z0-9._~-]*/[a-z0-9][a-z0-9._~-]*$", maxLength: 214 },
      version: { type: "string", pattern: "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$" },
      type: { const: "module" },
      description: { type: "string" },
      license: { ...text, not: { const: "UNLICENSED" } },
      homepage: text,
      repository: { anyOf: [text, { type: "object", required: ["url"], properties: { url: text } }] },
      keywords: list(),
      files: list(),
      engines: { type: "object", required: [appKey], properties: { [appKey]: text } },
      [appKey]: app,
    },
  };
}
