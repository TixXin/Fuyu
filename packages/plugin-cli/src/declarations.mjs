import { scanCode } from "@fuyu/plugin-review";

const SLOT_CALL = /\bslots\.add\(\s*(["'`])([^"'`$]+)\1/g;
const CLIENT_CALL = /\bclients\.add\(\s*(["'`])([^"'`$]+)\1/g;

const lineAt = (text, index) => text.slice(0, index).split("\n").length;

function allowedHost(host, network) {
  return network.some((pattern) => (pattern.startsWith("*.") ? host.endsWith(pattern.slice(1)) : host === pattern));
}

function literalCalls(pattern, file, code) {
  return [...code.matchAll(pattern)].map((match) => ({ name: match[2], file, line: lineAt(code, match.index) }));
}

export function compareDeclarations({ app, appKey = "fuyu", host, clients, nodeApis, sourceNodeApis }) {
  const warnings = [];
  const code = [...(host ? [host] : []), ...clients];
  const network = (app.network ?? []).map((item) => item.toLowerCase());
  const reported = new Set();
  for (const { file, text } of code) {
    for (const { domain, line } of scanCode(text).domains) {
      if (reported.has(domain) || allowedHost(domain, network)) continue;
      reported.add(domain);
      warnings.push({ code: "undeclared-domain", file, line, domain, message: `uses ${domain}, which is not in ${appKey}.network` });
    }
  }
  const slots = new Set(app.slots ?? []);
  for (const { file, text } of clients) {
    for (const call of literalCalls(SLOT_CALL, file, text)) {
      if (!slots.has(call.name)) warnings.push({ code: "undeclared-slot", file: call.file, line: call.line, message: `adds to the slot ${call.name}, which is not in ${appKey}.slots` });
    }
  }
  if (host) {
    const windows = new Set(Object.keys(app.client ?? {}));
    for (const call of literalCalls(CLIENT_CALL, host.file, host.text)) {
      if (!windows.has(call.name)) warnings.push({ code: "undeclared-window", file: call.file, line: call.line, message: `adds code to the window ${call.name}, which is not in ${appKey}.client` });
    }
  }
  if (Array.isArray(sourceNodeApis)) {
    const declared = new Set(sourceNodeApis);
    const missing = nodeApis.filter((name) => !declared.has(name));
    const unused = sourceNodeApis.filter((name) => !nodeApis.includes(name));
    if (missing.length || unused.length) {
      const parts = [missing.length ? `the code also uses ${missing.join(", ")}` : null, unused.length ? `the code does not use ${unused.join(", ")}` : null].filter(Boolean);
      warnings.push({ code: "node-apis", path: `${appKey}.nodeApis`, message: `${appKey}.nodeApis in the source is replaced by the build: ${parts.join("; ")}` });
    }
  }
  return warnings;
}
