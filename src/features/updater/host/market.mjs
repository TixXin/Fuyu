import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  mergeRevoked,
  openIndex,
  openRevoked,
  selectVersions,
  verifyVersionSignature,
} from "../../../../packages/plugin-market/src/index.mjs";
import {
  applyRevocationsToDir,
  inspectPackage as inspectFuyuPackage,
  installPackage,
  uninstallPackage,
  writeInstalledToYml,
} from "../../../../packages/plugin-cli/src/installer.mjs";
import { marketV1 } from "../../../../packages/plugin-services/src/services/market.mjs";
import {
  INDEX_FILE,
  INDEX_SIG_FILE,
  buildMarketSnapshot,
  confirmationFromManifest,
  decodeBase64,
  isObject,
  marketError,
  parseAppVersionFromArgv,
  readInstalledPackages,
  readState,
  readVerifiedCachedIndex,
  toTimestamp,
  writeState,
} from "./marketStore.mjs";

export { parseAppVersionFromArgv };

export const DEFAULT_TRUST = Object.freeze({
  index: Object.freeze([
    Object.freeze({
      keyId: "d5a27e09caa2594b",
      publicKey: "eDA1G3SVRyRrRYn6MrI7D3MPSANyngEApnk0U1v9tfE=",
    }),
  ]),
  revocation: Object.freeze([
    Object.freeze({
      keyId: "63fd60abfbf525be",
      publicKey: "GlFZU5NMzeKCWMUrp9euiH/Eemc0H6W2wDqolVd99ig=",
    }),
  ]),
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

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    catalog: async () => snapshot(),

    refresh: async () => {
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
      const opened = openIndex({
        text: indexText,
        signature: indexSig,
        trust,
        lastSerial: state.lastIndexSerial ?? undefined,
        now,
      });
      if (opened.status !== "ok") {
        throw marketError(opened.reason ?? opened.status, `Market index rejected: ${opened.reason ?? opened.status}`);
      }

      let nextRevocations = state.revocations;
      const revokedRes = await fetchImpl(revokedUrl);
      if (revokedRes && revokedRes.status !== 404) {
        if (!revokedRes.ok) {
          throw marketError("network", `Failed to fetch revocation list (${revokedRes.status})`);
        }
        const revokedText = await revokedRes.text();
        const revokedSigRes = await fetchImpl(`${revokedUrl}.sig`);
        if (!revokedSigRes?.ok) {
          throw marketError("bad-signature", `Missing revocation signature (${revokedSigRes?.status ?? "err"})`);
        }
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
        if (!merged.ok) {
          throw marketError(merged.reason, `Revocation merge rejected: ${merged.reason}`);
        }
        nextRevocations = merged.state;
        const applied = applyRevocationsToDir(pluginsDir, nextRevocations, { installed: readInstalledPackages(pluginsDir) });
        if (applied.disabled.length > 0 && onConfigChanged) await onConfigChanged();
      }

      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, INDEX_FILE), indexText, "utf8");
      writeFileSync(join(dataDir, INDEX_SIG_FILE), `${JSON.stringify(indexSig, null, 2)}\n`, "utf8");
      writeState(dataDir, {
        ...state,
        lastIndexSerial: opened.doc.serial,
        revocations: nextRevocations,
        updatedAt: toTimestamp(now),
        lastError: null,
      });
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
        confirmation: {
          ...inspected.confirmation,
          official: false,
          network: Array.isArray(fuyu.network) ? [...fuyu.network] : [],
        },
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
        const selected = selectVersions(pluginEntry, {
          fuyuVersion: appVersion,
          platform,
          now,
          revocations: state.revocations,
        });
        versionEntry = selected.install?.entry ?? selected.manual?.entry ?? null;
      }
      if (!versionEntry) throw marketError("not-found", `No matching version found for ${params.name}`);
      if (!versionEntry.platforms?.includes(platform)) {
        throw marketError("unsupported-platform", `${params.name}@${versionEntry.version} does not support ${platform}`);
      }
      const official = pluginEntry.publisher?.official === true;
      if (!official) {
        const keyId = verifyVersionSignature(pluginEntry, versionEntry);
        if (!keyId) throw marketError("bad-author-signature", `Author signature verification failed for ${params.name}@${versionEntry.version}`);
      }
      const res = await fetchImpl(versionEntry.url);
      if (!res?.ok) throw marketError("network", `Failed to download ${params.name}@${versionEntry.version} (${res?.status ?? "err"})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const installed = installPackage(buf, {
        dir: pluginsDir,
        source: "market",
        official,
        appVersion,
        expectedSha256: versionEntry.sha256,
        revocations: state.revocations,
      });
      if (onConfigChanged) await onConfigChanged();
      notifyChanged();
      return {
        id: installed.id,
        version: installed.version,
        source: "market",
        sha256: installed.sha256,
        confirmation: confirmationFromManifest(versionEntry.manifest, { unreviewed: false, official }),
      };
    },

    installFile: async (params) => {
      if (!isObject(params)) throw marketError("bad-params", "installFile expects { base64, expectedSha256? }");
      const state = readState(dataDir);
      if (state.manualAllowed !== true) {
        throw marketError("manual-disabled", "Manual .fuyu package installation is turned off");
      }
      const buf = decodeBase64(params.base64);
      const installed = installPackage(buf, {
        dir: pluginsDir,
        source: "manual",
        allowManual: true,
        appVersion,
        expectedSha256: typeof params.expectedSha256 === "string" ? params.expectedSha256 : undefined,
        revocations: state.revocations,
      });
      const pkgFile = join(installed.root, "package.json");
      let network = [];
      try {
        const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
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
        confirmation: {
          ...installed.confirmation,
          official: false,
          network,
        },
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
      const installed = readInstalledPackages(pluginsDir);
      const found = installed.find((item) => item.id === params.id);
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
      const res = uninstallPackage(pluginsDir, params.id, { removeData: params.removeData === true });
      if (onConfigChanged) await onConfigChanged();
      notifyChanged();
      return { id: res.id, removed: true };
    },
  };
}

export function provideMarketService(ctx, options = {}) {
  const reloadConfig = async () => {
    if (!ctx?.loader || typeof ctx.loader.entries !== "function") return;
    for (const entry of ctx.loader.entries()) {
      if (typeof entry?.subtree?.refresh === "function") {
        await entry.subtree.refresh();
      }
    }
  };
  const service = createMarketService({
    dataDir: ctx.dataDir,
    onConfigChanged: reloadConfig,
    ...options,
  });
  const provider = ctx.services.provide(marketV1, {
    catalog: () => service.catalog(),
    refresh: () => service.refresh(),
    inspectPackage: (params) => service.inspectPackage(params),
    installMarket: (params) => service.installMarket(params),
    installFile: (params) => service.installFile(params),
    setManualAllowed: (params) => service.setManualAllowed(params),
    setEnabled: (params) => service.setEnabled(params),
    uninstall: (params) => service.uninstall(params),
  });
  const off = service.subscribe((payload) => provider.emit("changed", payload));
  if (typeof ctx.effect === "function") ctx.effect(() => off, "market.v1.changed");
  return service;
}
