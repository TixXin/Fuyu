import { useEffect, useState } from "react";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { parseSites } from "./linkRules";

export function ClipboardSiteListRow({ id, title, description, placeholder, sites, onChange }: {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  sites: string[];
  onChange: (sites: string[]) => void;
}) {
  const saved = sites.join(", ");
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);
  return (
    <SettingsRow indent title={title} description={description} labelFor={id}>
      <SettingsInput
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => onChange(parseSites(draft))}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </SettingsRow>
  );
}
