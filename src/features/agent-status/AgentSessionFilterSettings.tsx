import { useState } from "react";
import { Folder, MessageSquareText, X } from "lucide-react";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useTranslation } from "../../i18n";
import type { SessionFilter } from "./sessionFilters";
import { useSessionFilters } from "./useSessionFilters";
import "./AgentSessionFilterSettings.css";

export function AgentSessionFilterSettings() {
  const text = useTranslation().settings.agent.filters;
  const [filters, setFilters] = useSessionFilters();
  const [kind, setKind] = useState<SessionFilter["kind"]>("folder");
  const [value, setValue] = useState("");

  const add = () => {
    if (!value.trim()) return;
    setFilters([...filters, { kind, value }]);
    setValue("");
  };

  return (
    <SettingsGroup title={text.title} footer={<SettingsFootnote text={text.hint} />}>
      {filters.map((filter, index) => {
        const Icon = filter.kind === "folder" ? Folder : MessageSquareText;
        return (
          <SettingsRow
            searchable={false}
            key={`${filter.kind}:${filter.value}`}
            title={
              <span className="session-filter__rule">
                <Icon className="session-filter__icon" size={14} strokeWidth={2} aria-hidden="true" />
                <span className="session-filter__value">{filter.value}</span>
              </span>
            }
            control={
              <>
                <span className="session-filter__badge">{text.kinds[filter.kind]}</span>
                <button
                  className="session-filter__remove"
                  type="button"
                  aria-label={text.remove(filter.value)}
                  onClick={() => setFilters(filters.filter((_, other) => other !== index))}
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              </>
            }
          />
        );
      })}
      <SettingsRow
        title={text.add}
        control={
          <SettingsChoice<SessionFilter["kind"]>
            value={kind}
            options={(["folder", "prompt"] as const).map((option) => ({ value: option, label: text.kinds[option] }))}
            ariaLabel={text.kindLabel}
            onChange={setKind}
          />
        }
      >
        <form
          className="session-filter__form"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <SettingsInput
            monospace={kind === "folder"}
            value={value}
            placeholder={kind === "folder" ? text.folderPlaceholder : text.promptPlaceholder}
            aria-label={text.add}
            onChange={(event) => setValue(event.target.value)}
          />
          <SettingsLinkButton disabled={!value.trim()} onClick={add}>{text.addButton}</SettingsLinkButton>
        </form>
      </SettingsRow>
    </SettingsGroup>
  );
}
