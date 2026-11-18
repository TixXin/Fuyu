import { useMemo } from "react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsNumberRow } from "../../components/settings/SettingsNumberRow";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useFlash } from "../../components/settings/useFlash";
import { useErrorText, useTranslation } from "../../i18n";
import { setBuiltinConfig } from "../plugin-kernel/builtinSwitches";
import { useBuiltinConfig } from "../plugin-kernel/useBuiltinPlugins";
import { CenterPattern } from "./CenterPattern";
import {
  CENTER_PATTERN_OPTIONS,
  CENTER_PATTERN_SIZE,
  centerConfig,
  petChoices,
  storedCenterValue,
  type CenterConfigKey,
  type CenterPatternSelection,
} from "./centerSettings.ts";
import { OWNER } from "./plugin/owner.ts";
import { usePetChoices } from "./usePetChoices";
import "./CenterPatternSettingsGroup.css";

export function CenterPatternSettingsGroup() {
  const text = useTranslation().settings.plugins.centerPattern;
  const errorText = useErrorText();
  const raw = useBuiltinConfig(OWNER);
  const config = useMemo(() => centerConfig(raw), [raw]);
  const pets = usePetChoices(true) ?? "loading";
  const choices = petChoices(pets, config.pet, text.pets);
  const [failure, flashFailure] = useFlash<string>();

  const save = (key: CenterConfigKey, value: string | number) => {
    void setBuiltinConfig(OWNER, key, storedCenterValue(key, value)).catch((reason: unknown) => flashFailure(errorText(reason)));
  };

  return (
    <SettingsGroup title={text.group} footer={failure ? <span className="plugin-card__error">{failure}</span> : <SettingsFootnote text={text.groupHint} />}>
      <SettingsRow
        title={text.pattern}
        control={
          <>
            <span className="center-pattern-preview" aria-hidden="true">
              <CenterPattern pattern={config.pattern === "pet" ? "eyes" : config.pattern} paused height={18} />
            </span>
            <SettingsSelect<CenterPatternSelection>
              value={config.pattern}
              ariaLabel={text.pattern}
              options={CENTER_PATTERN_OPTIONS.map((pattern) => ({ value: pattern, label: text.patterns[pattern] }))}
              onChange={(pattern) => save("pattern", pattern)}
            />
          </>
        }
      />
      <SettingsRow
        indent={config.pattern === "pet"}
        title={text.pet}
        description={text.petHint}
        control={
          <SettingsSelect
            value={config.pet}
            ariaLabel={text.pet}
            disabled={pets === "loading"}
            options={choices}
            onChange={(pet) => save("pet", pet)}
          />
        }
      />
      <SettingsNumberRow
        title={text.size}
        description={text.sizeHint}
        value={config.size}
        min={CENTER_PATTERN_SIZE.min}
        max={CENTER_PATTERN_SIZE.max}
        onChange={(size) => save("size", size)}
      />
    </SettingsGroup>
  );
}
