import { useEffect, useState } from "react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { CcConnectSection } from "./CcConnectSection";
import { OWNER } from "./plugin/owner.ts";
import { useCcConnect } from "./useCcConnect";

function save(key: "path" | "run", value: string | boolean | null) {
  void setBuiltinConfig(OWNER, key, value).catch((error: unknown) => console.error(`Could not save cc-connect's ${key}`, error));
}

export function CcConnectSettings() {
  const t = useTranslation().settings.plugins.ccConnect;
  const cc = useCcConnect();
  const [path, setPath] = useState(cc.path);
  useEffect(() => setPath(cc.path), [cc.path]);
  const commit = () => {
    const next = path.trim();
    if (next !== cc.path) save("path", next || null);
  };

  return (
    <>
      <SettingsGroup title={t.group} footer={t.groupHint}>
        <SettingsRow title={t.path} description={t.pathHint}>
          <SettingsInput
            monospace
            value={path}
            aria-label={t.path}
            onChange={(event) => setPath(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
            }}
          />
        </SettingsRow>
        <SettingsToggleRow title={t.run} description={t.runHint} checked={cc.run} onChange={(run) => save("run", run || null)} />
      </SettingsGroup>
      <CcConnectSection cc={cc} />
    </>
  );
}
