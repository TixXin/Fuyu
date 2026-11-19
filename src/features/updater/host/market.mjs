import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compareVersions, selectVersions } from "../../../../packages/plugin-market/src/index.mjs";
import { DATA_DIR, dataDirOf } from "../../../../packages/plugin-base/src/host/data.mjs";
import { applyRevocationsToDir, inspectPackage as inspectFuyuPackage, installPackage, removeInstalledFromYml, uninstallPackage, writeInstalledToYml } from "../../../../packages/plugin-cli/src/installer.mjs";
import { marketV1 } from "../../../../packages/plugin-services/src/services/market.mjs";
import { getMarketPluginDetails } from "./marketDetails.mjs";
import { fetchVerifiedIndex } from "./marketIndex.mjs";
import { createMarketInstaller } from "./marketInstall.mjs";
import { createMarketMedia } from "./marketMedia.mjs";
import { refreshRevocations } from "./marketRevocations.mjs";
import { createMarketDownloader } from "./marketSources.mjs";
import {
  INDEX_FILE, INDEX_SIG_FILE, buildMarketSnapshot, confirmationFromManifest, decodeBase64, detectTrustChange, isObject,
  marketError, parseAppVersionFromArgv, planRequiredDependencies, readInstalledPackages, readState, readYmlEntries, readVerifiedCachedIndex,
  resolvePinnedAuthor, revocationView, toTimestamp, writeState,
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
  const downloader = createMarketDownloader({ fetchImpl, now: () => toTimestamp(nowFn()) });
  const snapshot = () => buildMarketSnapshot({ dataDir, pluginsDir, appVersion, platform, trust, now: nowFn(), lastSource: downloader.last() });
  const media = createMarketMedia({ dataDir, downloader, readDoc: () => readVerifiedCachedIndex(dataDir, trust, nowFn()).doc });

  const { verifyMarketStep, downloadAndInstallSteps, runSilentAutoUpdates } = createMarketInstaller({ pluginsDir, appVersion, platform, downloader });

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    catalog: async () => snapshot(),

    details: (params) => getMarketPluginDetails(params, { dataDir, pluginsDir, appVersion, platform, trust, downloader, now: nowFn() }),

    media: (params) => media.get(params),

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
      const fetched = await fetchVerifiedIndex({ downloader, indexUrl, trust, lastSerial: state.lastIndexSerial ?? undefined, now });
      const opened = { doc: fetched.doc };
      const indexText = fetched.text;
      const indexSig = fetched.signature;

      const revoked = await refreshRevocations({ downloader, revokedUrl, trust, saved: state.revocations, now, index: opened.doc });
      const nextRevocations = revoked.revocations;

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
      if (revoked.updated) {
        disabledCount = applyRevocationsToDir(pluginsDir, nextRevocations, { installed: readInstalledPackages(pluginsDir) }).disabled.length;
      }

      writeState(dataDir, {
        ...state,
        lastIndexSerial: opened.doc.serial,
        revocations: nextRevocations,
        trustedAuthors: nextTrustedAuthors,
        updatedAt: toTimestamp(now),
        lastError: null,
        revocationWarning: revoked.warning,
        lastSource: downloader.last() ?? state.lastSource,
      });
      if ((disabledCount > 0 || upgradedCount > 0) && onConfigChanged) await onConfigChanged();
      notifyChanged();
      const next = snapshot();
      void media.refreshed(opened.doc, next.plugins);
      return next;
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
      const revocation = params.enabled ? revocationView(readState(dataDir).revocations, found.id, found.version) : null;
      if (revocation?.level === "disable") {
        throw marketError("revoked", `${found.id}@${found.version} has been revoked and cannot be turned on`, { reasons: revocation.reasons });
      }
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
      const subtree = entry?.subtree;
      if (typeof subtree?.reapply === "function") await subtree.reapply();
      else if (typeof subtree?.refresh === "function") await subtree.refresh();
    }
  };
  const service = createMarketService({ dataDir: ctx.dataDir, onConfigChanged: reloadConfig, ...options });
  const provider = ctx.services.provide(marketV1, {
    catalog: () => service.catalog(),
    details: (params) => service.details(params),
    media: (params) => service.media(params),
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
