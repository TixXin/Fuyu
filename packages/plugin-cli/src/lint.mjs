const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function screenshots({ app, appKey }) {
  if (Array.isArray(app.screenshots) && app.screenshots.length > 0) return [];
  return [
    {
      path: `${appKey}.screenshots`,
      code: "listing:screenshots",
      message: `no screenshots: list at least one in ${appKey}.screenshots (a plugin without its own interface shows the place where it takes effect)`,
    },
  ];
}

const RULES = [screenshots];

export function lintListing(dir, manifest, options = {}) {
  const appKey = options.appKey ?? "fuyu";
  const app = manifest?.[appKey];
  if (!isObject(app)) return [];
  return RULES.flatMap((rule) => rule({ dir, manifest, app, appKey }));
}
