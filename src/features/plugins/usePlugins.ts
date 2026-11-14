import { useCallback, useEffect, useState } from "react";
import { useFlash } from "../../components/settings/useFlash";
import { useErrorText, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import {
  checkPluginUpdates,
  clearPluginData,
  listPlugins,
  openPluginsFolder,
  reloadPlugins,
  revokePluginSensitivePermission,
  runPluginCommand,
  setPluginAutoUpdate,
  setPluginEnabled,
  setPluginPublisherTrusted,
  setPluginNotificationsMuted,
  setPluginWindowRules,
  setPluginPreRelease,
  setPluginMemoryLimit,
  setPluginSetting,
  setPluginsAllowed,
  uninstallPlugin,
  type PluginsSnapshot,
  type PluginWindowRules,
} from "./api";
import type { PromptedPermission } from "./promptedPermissions";

const REFRESH_MS = 2000;

export type PluginAction = "check" | "reload" | "folder" | "clearData" | "memory" | "command";
export type PluginNotice = { action: PluginAction; text: string };
type PluginDone = { action: PluginAction; text: (next: PluginsSnapshot | void) => string };

export function usePlugins() {
  const errorText = useErrorText();
  const [snapshot, setSnapshot] = useState<PluginsSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PluginAction | null>(null);
  const [notice, showNotice] = useFlash<PluginNotice>();
  const feedback = useTranslation().settings.plugins.feedback;

  const run = useCallback(async (action: () => Promise<PluginsSnapshot | void>, done?: PluginDone) => {
    setBusy(true);
    setPending(done?.action ?? null);
    showNotice(null);
    try {
      const next = await action();
      if (next) {
        setSnapshot(next);
      }
      setError("");
      if (done) showNotice({ action: done.action, text: done.text(next) });
    } catch (nextError) {
      setError(errorText(nextError));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }, [errorText, showNotice]);

  useEffect(() => {
    let didCancel = false;
    const refresh = () =>
      void listPlugins()
        .then((next) => !didCancel && setSnapshot(next))
        .catch((nextError: unknown) => !didCancel && setError(errorText(nextError)));
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => {
      didCancel = true;
      window.clearInterval(timer);
    };
  }, [errorText]);

  return {
    snapshot,
    error,
    busy,
    pending,
    notice,
    setAllowed: useCallback((allowed: boolean) => void run(() => setPluginsAllowed(allowed)), [run]),
    setEnabled: useCallback((id: string, enabled: boolean) => void run(() => setPluginEnabled(id, enabled)), [run]),
    reload: useCallback(
      () => void run(reloadPlugins, { action: "reload", text: (next) => feedback.reloaded(next ? next.plugins.length : 0) }),
      [run, feedback],
    ),
    openFolder: useCallback(
      () => void run(openPluginsFolder, { action: "folder", text: () => (isMacOS ? feedback.folderOpenedMac : feedback.folderOpened) }),
      [run, feedback],
    ),
    runCommand: useCallback(
      (id: string, command: string) =>
        void run(() => runPluginCommand(id, command), { action: "command", text: () => feedback.commandSent }),
      [run, feedback],
    ),
    uninstall: useCallback((id: string) => void run(() => uninstallPlugin(id)), [run]),
    clearData: useCallback(
      (id: string) => void run(() => clearPluginData(id), { action: "clearData", text: () => feedback.dataCleared }),
      [run, feedback],
    ),
    setAutoUpdate: useCallback((enabled: boolean) => void run(() => setPluginAutoUpdate(enabled)), [run]),
    untrustPublisher: useCallback((publisher: string) => void run(() => setPluginPublisherTrusted(publisher, false)), [run]),
    checkUpdates: useCallback(
      () =>
        void run(checkPluginUpdates, {
          action: "check",
          text: (next) => {
            const found = next ? next.plugins.filter((plugin) => plugin.updateAvailable).length : 0;
            return found > 0 ? feedback.found(found) : feedback.upToDate;
          },
        }),
      [run, feedback],
    ),
    revokeSensitive: useCallback(
      (id: string, permission: PromptedPermission) => void run(() => revokePluginSensitivePermission(id, permission)),
      [run],
    ),
    setMemoryLimit: useCallback(
      (id: string, megabytes: number) =>
        void run(() => setPluginMemoryLimit(id, megabytes), { action: "memory", text: () => feedback.saved }),
      [run, feedback],
    ),
    setPreRelease: useCallback(
      (id: string, enabled: boolean) => void run(() => setPluginPreRelease(id, enabled)),
      [run],
    ),
    setNotificationsMuted: useCallback(
      (id: string, muted: boolean) => void run(() => setPluginNotificationsMuted(id, muted)),
      [run],
    ),
    setWindowRules: useCallback(
      (id: string, rules: PluginWindowRules) => void run(() => setPluginWindowRules(id, rules)),
      [run],
    ),
    setSetting: useCallback(
      (id: string, key: string, value: unknown) => void run(() => setPluginSetting(id, key, value)),
      [run],
    ),
  };
}
