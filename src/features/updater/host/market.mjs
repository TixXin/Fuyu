import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compareVersions, mergeRevoked, openIndex, openRevoked, selectVersions, verifyVersionSignature } from "../../../../packages/plugin-market/src/index.mjs";
import { DATA_DIR, dataDirOf } from "../../../../packages/plugin-base/src/host/data.mjs";
import { applyRevocationsToDir, inspectPackage as inspectFuyuPackage, installPackage, removeInstalledFromYml, uninstallPackage, writeInstalledToYml } from "../../../../packages/plugin-cli/src/installer.mjs";
import { marketV1 } from "../../../../packages/plugin-services/src/services/market.mjs";
import { getMarketPluginDetails } from "./marketDetails.mjs";
import {
  INDEX_FILE, INDEX_SIG_FILE, buildMarketSnapshot, confirmationFromManifest, decodeBase64, detectTrustChange, isObject,
  marketError, parseAppVersionFromArgv, planRequiredDependencies, readInstalledPackages, readState, readYmlEntries, readVerifiedCachedIndex,
  resolvePinnedAuthor, toTimestamp, writeState,
} from "./marketStore.mjs";

export { parseAppVersionFromArgv };

export const DEFAULT_TRUST = Object.freeze({
  index: Object.freeze([Object.freeze({ keyId: "d5a27e09caa2594b", publicKey: "eDA1G3SVRyRrRYn6MrI7D3MPSANyngEApnk0U1v9tfE=" })]),
  revocation: Object.freeze([Object.freeze({ keyId: "63fd60abfbf525be", publicKey: "GlFZU5NMzeKCWMUrp9euiH/Eemc0H6W2wDqolVd99ig=" })]),
});

export const DEFAULT_INDEX_URL = "https://raw.githubusercontent.com/TixXin/fuyu-plugins/main/index.v3.json";
export const DEFAULT_REVOKED_URL = "https://raw.githubusercontent.com/TixXin/fuyu-plugins/main/revoked.v3.json";

export function createMarketService(options = {}) {
  const dataDir = options.dataDir;
  if (typeof dataDir !== "string" || !dataDir) throw new TypeError("createMarketService requires options.dataDir");
  const pluginsDir = options.pluginsDir ?? dirname(dirname(dataDir));
  const appVersion = options.appVersion ?? parseAppVersionFromArgv();
  const platform = options.platform ?? (process.platform === "darwin" ? "macos" : "windows");
  const trust = options.trust ?? DEFAULT_TRUST;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const indexUrl = options.indexUrl ?? DEFAULT_INDEX_URL;
  const revokedUrl = options.revokedUrl ?? DEFAULT_REVOKED_URL;
  const nowFn = typeof options.now === "function" ? options.now : () => options.now ?? Date.now();
  const onConfigChanged = typeof options.onConfigChanged === "function" ? options.onConfigChanged : null;
  const listeners = new Set();

  const notifyChanged = () => {
    for (const fn of [...listeners]) fn({});
  };
  const snapshot = () => buildMarketSnapshot({ dataDir, pluginsDir, appVersion, platform, trust, now: nowFn() });

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

  const downloadAndInstallSteps = async (steps, revocations, trustedAuthors) => {
    const downloaded = [];
    for (const step of steps) {
      const res = await fetchImpl(step.versionEntry.url);
      if (!res?.ok) throw marketError("network", `Failed to download ${step.pluginEntry.name}@${step.versionEntry.version} (${res?.status ?? "err"})`);
      const buf = Buffer.from(await res.arrayBuffer());
      inspectFuyuPackage(buf, { source: "market", official: step.official, appVersion, expectedSha256: step.versionEntry.sha256 });
      downloaded.push({ ...step, buf });
    }
    const nextTrusted = { ...trustedAuthors };
    let lastInstalled = null;
    for (const item of downloaded) {
      lastInstalled = installPackage(item.buf, {
        dir: pluginsDir,
        source: "market",
        official: item.official,
        appVersion,
        expectedSha256: item.versionEntry.sha256,
        revocations,
      });
      nextTrusted[item.pluginEntry.name] = {
        keyId: item.official ? null : (item.versionEntry.authorSignature?.keyId ?? item.keyId),
        repository: item.versionEntry.repository,
      };
    }
    return { lastInstalled, trustedAuthors: nextTrusted };
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

      try {
        const depPlan = planRequiredDependencies({ doc, rootName: pluginEntry.name, rootEntry: candidate, installedById, appVersion, platform, now, revocations, strict: true });
        const unsafeDep = depPlan.some((dep) => {
          const depInst = installedById.get(dep.name);
          if (!depInst) return true;
          return detectTrustChange(dep.plugin, dep.entry, resolvePinnedAuthor(dep.plugin, depInst.version, nextTrusted)) !== null;
        });
        if (unsafeDep) continue;
        const steps = [...depPlan.map((dep) => verifyMarketStep(dep.plugin, dep.entry)), verifyMarketStep(pluginEntry, candidate)];
        const res = await downloadAndInstallSteps(steps, revocations, nextTrusted);
        nextTrusted = res.trustedAuthors;
        for (const step of steps) {
          installedById.set(step.pluginEntry.name, { id: step.pluginEntry.name, version: step.versionEntry.version, source: "market", enabled: true });
        }
        upgradedCount += 1;
      } catch {
        continue;
      }
    }
    return { upgradedCount, trustedAuthors: nextTrusted };
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    catalog: async () => snapshot(),

    details: (params) => getMarketPluginDetails(params, { dataDir, pluginsDir, appVersion, platform, trust, fetchImpl, now: nowFn() }),

    autoUpdate: async () => {
      const state = readState(dataDir);
      const now = nowFn();
      const { doc } = readVerifiedCachedIndex(dataDir, trust, now);
      if (!doc) return snapshot();
      const { upgradedCount, trustedAuthors } = await runSilentAutoUpdates({ doc, revocations: state.revocations, trustedAuthors: state.trustedAuthors, now });
      if (upgradedCount > 0) {
        writeState(dataDir, { ...state, trustedAuthors });
        if (onConfigChanged) await onConfigChanged();
        notifyChanged();
      }
      return snapshot();
    },

    refresh: async (params = {}) => {
      const shouldAutoUpdate = !isObject(params) || params.autoUpdate !== false;
      const state = readState(dataDir);
      const now = nowFn();
      const [indexRes, indexSigRes] = await Promise.all([fetchImpl(indexUrl), fetchImpl(`${indexUrl}.sig`)]);
      if (!indexRes?.ok || !indexSigRes?.ok) {
        throw marketError("network", `Failed to fetch market index (${indexRes?.status ?? "err"}/${indexSigRes?.status ?? "err"})`);
      }
      const indexText = await indexRes.text();
      let indexSig;
      try {
        indexSig = JSON.parse(await indexSigRes.text());
      } catch {
        throw marketError("bad-signature", "Market index signature is not valid JSON");
      }
      const opened = openIndex({ text: indexText, signature: indexSig, trust, lastSerial: state.lastIndexSerial ?? undefined, now });
      if (opened.status !== "ok") {
        throw marketError(opened.reason ?? opened.status, `Market index rejected: ${opened.reason ?? opened.status}`);
      }

      let nextRevocations = state.revocations;
      let hasRevocationUpdate = false;
      const revokedRes = await fetchImpl(revokedUrl);
      if (revokedRes && revokedRes.status !== 404) {
        if (!revokedRes.ok) throw marketError("network", `Failed to fetch revocation list (${revokedRes.status})`);
        const revokedText = await revokedRes.text();
        const revokedSigRes = await fetchImpl(`${revokedUrl}.sig`);
        if (!revokedSigRes?.ok) throw marketError("bad-signature", `Missing revocation signature (${revokedSigRes?.status ?? "err"})`);
        let revokedSig;
        try {
          revokedSig = JSON.parse(await revokedSigRes.text());
        } catch {
          throw marketError("bad-signature", "Revocation signature is not valid JSON");
        }
        const revOpened = openRevoked({
          text: revokedText,
          signature: revokedSig,
          trust,
          lastSerial: (state.revocations?.serial ?? -1) >= 0 ? state.revocations.serial : undefined,
          now,
        });
        if (revOpened.status !== "ok") {
          throw marketError(revOpened.reason ?? revOpened.status, `Revocation list rejected: ${revOpened.reason ?? revOpened.status}`);
        }
        const merged = mergeRevoked(state.revocations, revOpened.doc);
        if (!merged.ok) throw marketError(merged.reason, `Revocation merge rejected: ${merged.reason}`);
        nextRevocations = merged.state;
        hasRevocationUpdate = true;
      }

      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, INDEX_FILE), indexText, "utf8");
      writeFileSync(join(dataDir, INDEX_SIG_FILE), `${JSON.stringify(indexSig, null, 2)}\n`, "utf8");

      let nextTrustedAuthors = state.trustedAuthors;
      let upgradedCount = 0;
      if (shouldAutoUpdate) {
        const autoRes = await runSilentAutoUpdates({ doc: opened.doc, revocations: nextRevocations, trustedAuthors: nextTrustedAuthors, now });
        upgradedCount = autoRes.upgradedCount;
        nextTrustedAuthors = autoRes.trustedAuthors;
      }

      let disabledCount = 0;
      if (hasRevocationUpdate) {
        disabledCount = applyRevocationsToDir(pluginsDir, nextRevocations, { installed: readInstalledPackages(pluginsDir) }).disabled.length;
      }

      writeState(dataDir, {
        ...state,
        lastIndexSerial: opened.doc.serial,
        revocations: nextRevocations,
        trustedAuthors: nextTrustedAuthors,
        updatedAt: toTimestamp(now),
        lastError: null,
      });
      if ((disabledCount > 0 || upgradedCount > 0) && onConfigChanged) await onConfigChanged();
      notifyChanged();
      return snapshot();
    },

    inspectPackage: async (params) => {
      if (!isObject(params)) throw marketError("bad-params", "inspectPackage expects { base64 }");
      const buf = decodeBase64(params.base64);
      const inspected = inspectFuyuPackage(buf, { source: "manual", allowManual: true, appVersion });
      const fuyu = isObject(inspected.manifest?.fuyu) ? inspected.manifest.fuyu : {};
      return {
        id: inspected.id,
        version: inspected.version,
        sha256: inspected.sha256,
        confirmation: { ...inspected.confirmation, official: false, network: Array.isArray(fuyu.network) ? [...fuyu.network] : [] },
      };
    },

    installMarket: async (params) => {
      if (!isObject(params) || typeof params.name !== "string" || !params.name) {
        throw marketError("bad-params", "installMarket expects { name, version? }");
      }
      const state = readState(dataDir);
      const now = nowFn();
      const { doc, error } = readVerifiedCachedIndex(dataDir, trust, now);
      if (!doc) throw marketError(error ?? "no-index", "Market index is not available; refresh first");
      const pluginEntry = doc.plugins.find((item) => item.name === params.name);
      if (!pluginEntry) throw marketError("not-found", `Plugin ${params.name} is not in the market index`);
      let versionEntry = null;
      if (typeof params.version === "string" && params.version) {
        versionEntry = pluginEntry.versions.find((item) => item.version === params.version) ?? null;
      } else {
        const selected = selectVersions(pluginEntry, { fuyuVersion: appVersion, platform, now, revocations: state.revocations });
        versionEntry = selected.install?.entry ?? selected.manual?.entry ?? null;
      }
      if (!versionEntry) throw marketError("not-found", `No matching version found for ${params.name}`);

      const installedById = new Map(readInstalledPackages(pluginsDir).map((item) => [item.id, item]));
      const currentInst = installedById.get(pluginEntry.name) ?? null;
      const currentPin = currentInst ? resolvePinnedAuthor(pluginEntry, currentInst.version, state.trustedAuthors) : null;
      const isUpgrade = Boolean(currentInst) && compareVersions(versionEntry.version, currentInst.version) > 0;
      const trustChange = isUpgrade ? detectTrustChange(pluginEntry, versionEntry, currentPin) : null;

      const depPlan = planRequiredDependencies({ doc, rootName: pluginEntry.name, rootEntry: versionEntry, installedById, appVersion, platform, now, revocations: state.revocations, strict: true });
      const steps = [...depPlan.map((dep) => verifyMarketStep(dep.plugin, dep.entry)), verifyMarketStep(pluginEntry, versionEntry)];
      const { lastInstalled, trustedAuthors } = await downloadAndInstallSteps(steps, state.revocations, state.trustedAuthors);
      writeState(dataDir, { ...state, trustedAuthors });
      if (onConfigChanged) await onConfigChanged();
      notifyChanged();
      return {
        id: lastInstalled.id,
        version: lastInstalled.version,
        source: "market",
        sha256: lastInstalled.sha256,
        confirmation: confirmationFromManifest(versionEntry.manifest, { unreviewed: false, official: pluginEntry.publisher?.official === true, trustChange, requiredPlugins: depPlan.map((dep) => dep.name) }),
      };
    },

    installFile: async (params) => {
      if (!isObject(params)) throw marketError("bad-params", "installFile expects { base64, expectedSha256? }");
      const state = readState(dataDir);
      if (state.manualAllowed !== true) throw marketError("manual-disabled", "Manual .fuyu package installation is turned off");
      const buf = decodeBase64(params.base64);
      const installed = installPackage(buf, {
        dir: pluginsDir,
        source: "manual",
        allowManual: true,
        appVersion,
        expectedSha256: typeof params.expectedSha256 === "string" ? params.expectedSha256 : undefined,
        revocations: state.revocations,
      });
      let network = [];
      try {
        const pkg = JSON.parse(readFileSync(join(installed.root, "package.json"), "utf8"));
        if (Array.isArray(pkg?.fuyu?.network)) network = [...pkg.fuyu.network];
      } catch {
        network = [];
      }
      if (onConfigChanged) await onConfigChanged();
      notifyChanged();
      return {
        id: installed.id,
        version: installed.version,
        source: "manual",
        sha256: installed.sha256,
        confirmation: { ...installed.confirmation, official: false, network },
      };
    },

    setManualAllowed: async (params) => {
      if (!isObject(params) || typeof params.allowed !== "boolean") {
        throw marketError("bad-params", "setManualAllowed expects { allowed: boolean }");
      }
      const state = readState(dataDir);
      writeState(dataDir, { ...state, manualAllowed: params.allowed });
      notifyChanged();
      return { manualAllowed: params.allowed };
    },

    setEnabled: async (params) => {
      if (!isObject(params) || typeof params.id !== "string" || typeof params.enabled !== "boolean") {
        throw marketError("bad-params", "setEnabled expects { id: string, enabled: boolean }");
      }
      const found = readInstalledPackages(pluginsDir).find((item) => item.id === params.id);
      if (!found) throw marketError("not-found", `Installed plugin ${params.id} was not found`);
      writeInstalledToYml(join(pluginsDir, "plugins.yml"), {
        id: found.id,
        source: found.source,
        disabled: !params.enabled,
        replaces: found.replaces,
      });
      if (onConfigChanged) await onConfigChanged();
      notifyChanged();
      return { id: found.id, enabled: params.enabled };
    },

    uninstall: async (params) => {
      if (!isObject(params) || typeof params.id !== "string" || !params.id) {
        throw marketError("bad-params", "uninstall expects { id: string, removeData?: boolean }");
      }
      const ymlFile = join(pluginsDir, "plugins.yml");
      const registered = readYmlEntries(ymlFile).get(params.id);
      if (registered?.source === "dev" || (registered && registered.source === null && registered.name)) {
        removeInstalledFromYml(ymlFile, params.id);
        if (params.removeData === true) rmSync(dataDirOf(join(pluginsDir, DATA_DIR), params.id), { recursive: true, force: true });
      } else {
        const found = readInstalledPackages(pluginsDir).find((item) => item.id === params.id);
        if (!found) throw marketError("not-found", `Installed plugin ${params.id} was not found`);
        uninstallPackage(pluginsDir, found.id, { removeData: params.removeData === true });
      }
      if (onConfigChanged) await onConfigChanged();
      notifyChanged();
      return { id: params.id, removed: true };
    },
  };
}

export const SETTINGS_WINDOW = "settings";
export const SETTINGS_ONLY_METHODS = Object.freeze(["refresh", "installMarket", "installFile", "setManualAllowed", "setEnabled", "uninstall"]);

export function assertSettingsWindow(method, caller) {
  if (caller?.window === SETTINGS_WINDOW && caller.plugin === undefined) return;
  const who = typeof caller?.plugin === "string" ? `plugin ${caller.plugin}` : typeof caller?.window === "string" ? `window "${caller.window}"` : "an unknown caller";
  throw marketError("forbidden", `market/v1 ${method} only answers the settings window, not ${who}`);
}

export function provideMarketService(ctx, options = {}) {
  const reloadConfig = async () => {
    if (!ctx?.loader || typeof ctx.loader.entries !== "function") return;
    for (const entry of ctx.loader.entries()) {
      if (typeof entry?.subtree?.refresh === "function") await entry.subtree.refresh();
    }
  };
  const service = createMarketService({ dataDir: ctx.dataDir, onConfigChanged: reloadConfig, ...options });
  const provider = ctx.services.provide(marketV1, {
    catalog: () => service.catalog(),
    details: (params) => service.details(params),
    inspectPackage: (params) => service.inspectPackage(params),
    ...Object.fromEntries(SETTINGS_ONLY_METHODS.map((method) => [method, (params, caller) => {
      assertSettingsWindow(method, caller);
      return service[method](params);
    }])),
  });
  const off = service.subscribe((payload) => provider.emit("changed", payload));
  if (typeof ctx.effect === "function") ctx.effect(() => off, "market.v1.changed");
  return service;
}
