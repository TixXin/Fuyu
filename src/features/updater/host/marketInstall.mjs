import { compareVersions, selectVersions, verifyVersionSignature } from "../../../../packages/plugin-market/src/index.mjs";
import { commitStaged, discardStaged, stagePackage } from "../../../../packages/plugin-cli/src/installer.mjs";
import { sha256Hex } from "../../../../packages/plugin-manifest/src/index.mjs";
import { newCapabilities, capabilitiesOf } from "./marketCapabilities.mjs";
import { detectTrustChange, marketError, planRequiredDependencies, readInstalledPackages, resolvePinnedAuthor } from "./marketStore.mjs";

export const PACKAGE_TIMEOUT_MS = 120 * 1000;

export function createMarketInstaller({ pluginsDir, appVersion, platform, downloader }) {
  const verifyMarketStep = (pluginEntry, versionEntry) => {
    if (!versionEntry.platforms?.includes(platform)) {
      throw marketError("unsupported-platform", `${pluginEntry.name}@${versionEntry.version} does not support ${platform}`);
    }
    const official = pluginEntry.publisher?.official === true;
    const keyId = official ? null : verifyVersionSignature(pluginEntry, versionEntry);
    if (!official && !keyId) {
      throw marketError("bad-author-signature", `Author signature verification failed for ${pluginEntry.name}@${versionEntry.version}`);
    }
    return { pluginEntry, versionEntry, official, keyId };
  };

  const downloadAndInstallSteps = async (steps, revocations, trustedAuthors, checkStaged = null) => {
    const downloaded = [];
    for (const step of steps) {
      const label = `${step.pluginEntry.name}@${step.versionEntry.version}`;
      const buf = await downloader.run(step.versionEntry.url, async (source) => {
        const res = await source.get(step.versionEntry.url, { timeoutMs: PACKAGE_TIMEOUT_MS, as: "bytes" });
        if (res.missing) throw marketError("network", "answered 404");
        const sha256 = sha256Hex(res.bytes);
        if (typeof step.versionEntry.sha256 !== "string" || sha256 !== step.versionEntry.sha256.toLowerCase()) {
          throw marketError("bad-sha256", `Package SHA-256 mismatch: expected ${step.versionEntry.sha256}, got ${sha256}`);
        }
        return res.bytes;
      }, label);
      downloaded.push({ ...step, buf });
    }
    const staged = [];
    try {
      for (const item of downloaded) {
        staged.push(stagePackage(item.buf, {
          dir: pluginsDir,
          source: "market",
          official: item.official,
          appVersion,
          expectedSha256: item.versionEntry.sha256,
          expectedName: item.pluginEntry.name,
          expectedVersion: item.versionEntry.version,
          revocations,
        }));
        if (checkStaged) checkStaged(staged[staged.length - 1]);
      }
    } catch (error) {
      discardStaged(staged);
      throw error;
    }
    const installed = commitStaged(pluginsDir, staged);
    const nextTrusted = { ...trustedAuthors };
    for (const item of downloaded) {
      nextTrusted[item.pluginEntry.name] = {
        keyId: item.official ? null : (item.versionEntry.authorSignature?.keyId ?? item.keyId),
        repository: item.versionEntry.repository,
      };
    }
    return { lastInstalled: installed[installed.length - 1], trustedAuthors: nextTrusted };
  };

  const runSilentAutoUpdates = async ({ doc, revocations, trustedAuthors, now }) => {
    const installedList = readInstalledPackages(pluginsDir);
    const installedById = new Map(installedList.map((item) => [item.id, item]));
    let nextTrusted = { ...trustedAuthors };
    let upgradedCount = 0;

    for (const inst of installedList) {
      if (inst.source !== "market" || !inst.enabled) continue;
      const pluginEntry = doc.plugins.find((item) => item.name === inst.id);
      if (!pluginEntry) continue;
      const selected = selectVersions(pluginEntry, { fuyuVersion: appVersion, platform, now, installed: inst.version, revocations });
      const candidate = selected.autoUpdate?.entry ?? null;
      if (!candidate || compareVersions(candidate.version, inst.version) <= 0) continue;
      const pin = resolvePinnedAuthor(pluginEntry, inst.version, nextTrusted);
      if (detectTrustChange(pluginEntry, candidate, pin) !== null) continue;
      if (newCapabilities(inst.capabilities, candidate.manifest)) continue;

      try {
        const depPlan = planRequiredDependencies({ doc, rootName: pluginEntry.name, rootEntry: candidate, installedById, appVersion, platform, now, revocations, strict: true });
        const unsafeDep = depPlan.some((dep) => {
          const depInst = installedById.get(dep.name);
          if (!depInst || newCapabilities(depInst.capabilities, dep.entry.manifest)) return true;
          return detectTrustChange(dep.plugin, dep.entry, resolvePinnedAuthor(dep.plugin, depInst.version, nextTrusted)) !== null;
        });
        if (unsafeDep) continue;
        const steps = [...depPlan.map((dep) => verifyMarketStep(dep.plugin, dep.entry)), verifyMarketStep(pluginEntry, candidate)];
        const res = await downloadAndInstallSteps(steps, revocations, nextTrusted, (staged) => {
          if (newCapabilities(installedById.get(staged.id)?.capabilities, staged.confirmation)) {
            throw marketError("new-capabilities", `${staged.id}@${staged.version} would do more than the installed version (new Node modules, sites or replaced services)`);
          }
        });
        nextTrusted = res.trustedAuthors;
        for (const step of steps) {
          installedById.set(step.pluginEntry.name, {
            id: step.pluginEntry.name,
            version: step.versionEntry.version,
            source: "market",
            enabled: true,
            capabilities: capabilitiesOf(step.versionEntry.manifest),
          });
        }
        upgradedCount += 1;
      } catch {
        continue;
      }
    }
    return { upgradedCount, trustedAuthors: nextTrusted };
  };

  return { verifyMarketStep, downloadAndInstallSteps, runSilentAutoUpdates };
}
