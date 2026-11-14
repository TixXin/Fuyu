import { ToggleControl } from "../../components/controls/ToggleControl";
import { useTranslation } from "../../i18n";
import type { PluginWindowRules } from "./api";

export function PluginWindowRulesSection({
  rules,
  busy,
  onChange,
}: {
  rules: PluginWindowRules;
  busy: boolean;
  onChange: (rules: PluginWindowRules) => void;
}) {
  const t = useTranslation();
  const text = t.settings.plugins.detail;
  const change = (patch: PluginWindowRules) => !busy && onChange({ ...rules, ...patch });
  return (
    <section className="settings-section plugins-panel">
      <div className="settings-section__header">
        <span>{text.windows}</span>
      </div>
      <ToggleControl label={text.windowsNoTopmost} checked={Boolean(rules.noTopmost)} onChange={(noTopmost) => change({ noTopmost })} />
      <ToggleControl label={text.windowsNoClickThrough} checked={Boolean(rules.noClickThrough)} onChange={(noClickThrough) => change({ noClickThrough })} />
      <ToggleControl label={text.windowsHidden} checked={Boolean(rules.hidden)} onChange={(hidden) => change({ hidden })} />
      <p className="settings-section__hint">{text.windowsHint}</p>
    </section>
  );
}
