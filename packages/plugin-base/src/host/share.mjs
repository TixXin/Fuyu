import module from "node:module";

const shared = new Map();
let installed = false;

export function shareModules(entries) {
  for (const [name, url] of Object.entries(entries)) shared.set(name, url);
  if (installed || shared.size === 0) return;
  installed = true;
  module.registerHooks({
    resolve(specifier, context, next) {
      const url = shared.get(specifier);
      if (url) return { url, format: "module", shortCircuit: true };
      return next(specifier, context);
    },
  });
}

export function sharedModules() {
  return Object.fromEntries(shared);
}
