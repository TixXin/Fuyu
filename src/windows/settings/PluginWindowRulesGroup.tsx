import { useEffect, useId, useState } from "react";
import { pluginWindowsV1, type PluginWindowRules } from "@fuyu/plugin-services";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText, useTranslation } from "../../i18n";
import type { PluginStatusV3 } from "./usePluginHostStatus";

const pluginWindowsClient = windowServices.get(pluginWindowsV1);

type RuleKey = keyof PluginWindowRules;

export function PluginWindowRulesGroup({ plugin }: { plugin: PluginStatusV3 }) {
  const copy = useTranslation().settings.pluginsV3.windowRules;
  const errorText = useErrorText();
  const baseId = useId();

  const [rules, setRules] = useState<PluginWindowRules | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => {
      void Promise.all([
        pluginWindowsClient.getRules({ id: plugin.id }),
        pluginWindowsClient.list({ id: plugin.id }),
      ])
        .then(([loadedRules, winList]) => {
          if (!live) return;
          setRules(loadedRules);
          setOpenCount(winList.items.filter((item) => item.pluginId === plugin.id).length);
        })
        .catch(() => {
          if (live) setRules(null);
        });
    };
    load();
    const offWatch = windowServices.watch(load);
    const offChanged = pluginWindowsClient.on("changed", (payload) => {
      if (!live) return;
      setOpenCount(payload.items.filter((item) => item.pluginId === plugin.id).length);
      if (payload.rules && payload.rules.id === plugin.id) {
        setRules({
          disallowAlwaysOnTop: payload.rules.disallowAlwaysOnTop,
          disallowClickThrough: payload.rules.disallowClickThrough,
          hideAll: payload.rules.hideAll,
        });
      }
    });
    return () => {
      live = false;
      offWatch();
      void offChanged();
    };
  }, [plugin.id]);

  if (!rules) return null;
  const hasActiveRule = rules.disallowAlwaysOnTop || rules.disallowClickThrough || rules.hideAll;
  const isBuiltinHost = plugin.kind === "builtin" || plugin.kind === "essential";
  if (isBuiltinHost && openCount === 0 && !hasActiveRule && plugin.source !== "dev") {
    return null;
  }

  const toggleRule = (key: RuleKey, nextValue: boolean) => {
    setBusy(true);
    setError(null);
    void pluginWindowsClient
      .setRules({ id: plugin.id, [key]: nextValue })
      .then((updated) => setRules(updated))
      .catch((failure: unknown) => setError(errorText(failure)))
      .finally(() => setBusy(false));
  };

  const rows: { key: RuleKey; label: string; hint: string }[] = [
    { key: "disallowAlwaysOnTop", label: copy.disallowAlwaysOnTop, hint: copy.disallowAlwaysOnTopHint },
    { key: "disallowClickThrough", label: copy.disallowClickThrough, hint: copy.disallowClickThroughHint },
    { key: "hideAll", label: copy.hideAll, hint: copy.hideAllHint },
  ];

  return (
    <section className="plugins-v3__rules-group" data-plugin-window-rules={plugin.id}>
      <div className="plugins-v3__subhead">
        <h4 className="plugins-v3__subheading">{copy.heading}</h4>
        {openCount > 0 ? <span className="plugins-v3__pill">{copy.openCount(openCount)}</span> : null}
      </div>

      {error ? <p className="plugins-v3__error-banner">{error}</p> : null}

      <div className="plugins-v3__schema-list">
        {rows.map(({ key, label, hint }) => {
          const switchId = `${baseId}-${key}`;
          return (
            <div key={key} className="plugins-v3__schema-row" data-window-rule={key}>
              <div className="plugins-v3__schema-copy">
                <label className="plugins-v3__schema-label" htmlFor={switchId}>
                  {label}
                </label>
                <span className="plugins-v3__schema-desc">{hint}</span>
              </div>
              <div className="plugins-v3__schema-control">
                <SettingsSwitch
                  id={switchId}
                  checked={rules[key]}
                  disabled={busy}
                  onChange={(checked) => toggleRule(key, checked)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
