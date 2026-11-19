import { MIN_BUNDLE_PLUGINS } from "../../../../packages/plugin-market/src/index.mjs";

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

export function bundleMember(name, plugin) {
  if (!plugin) return { name, state: "unavailable", reason: "missing" };
  if (plugin.installedVersion) return { name, state: plugin.enabled ? "installed" : "disabled" };
  if (plugin.install && !plugin.revoked) return { name, state: "available" };
  if (plugin.revoked) return { name, state: "unavailable", reason: "revoked" };
  if (plugin.blocked?.reason === "engines" || plugin.blocked?.reason === "platform") return { name, state: "unavailable", reason: plugin.blocked.reason };
  return { name, state: "unavailable", reason: plugin.manual?.warned ? "warned" : "other" };
}

export function bundleViews(doc, plugins) {
  const byName = new Map(plugins.map((plugin) => [plugin.name, plugin]));
  return (Array.isArray(doc?.bundles) ? doc.bundles : []).flatMap((bundle) => {
    if (!isObject(bundle) || typeof bundle.id !== "string" || !Array.isArray(bundle.plugins)) return [];
    const members = bundle.plugins.filter((name) => typeof name === "string").map((name) => bundleMember(name, byName.get(name)));
    if (members.filter((member) => member.state !== "unavailable").length < MIN_BUNDLE_PLUGINS) return [];
    return [{
      id: bundle.id,
      displayName: isObject(bundle.displayName) ? bundle.displayName : { "zh-CN": bundle.id, en: bundle.id },
      description: isObject(bundle.description) ? bundle.description : { "zh-CN": "", en: "" },
      onboarding: bundle.onboarding === true,
      members,
    }];
  });
}

export function createBundleInstaller({ snapshot, installOne, installedIds, afterInstall, fail }) {
  return async (params) => {
    if (!isObject(params) || typeof params.id !== "string" || !params.id) throw fail("bad-params", "installBundle expects { id }");
    const bundle = snapshot().bundles.find((item) => item.id === params.id);
    if (!bundle) throw fail("not-found", `Bundle ${params.id} is not in the market index`);
    const installed = [];
    const failed = [];
    for (const member of bundle.members) {
      if (member.state !== "available" || installedIds().has(member.name)) continue;
      try {
        const result = await installOne({ name: member.name }, { announce: false });
        installed.push({ name: member.name, version: result.version });
      } catch (error) {
        failed.push({ name: member.name, code: typeof error?.code === "string" ? error.code : "failed", message: String(error?.message ?? error) });
      }
    }
    if (installed.length > 0) await afterInstall();
    return { id: bundle.id, installed, failed };
  };
}
