import { useContext, useState } from "react";
import { useTranslation } from "../../i18n";
import { splitLead } from "../../utils/splitLead";
import { SettingsDisabledContext } from "./SettingsGroup";
import "./SettingsFootnote.css";

export function SettingsFootnote({ text, disabled = false }: { text: string; disabled?: boolean }) {
  const labels = useTranslation().common;
  const areaDisabled = useContext(SettingsDisabledContext);
  const [open, setOpen] = useState(false);
  const [lead, rest] = splitLead(text);

  return (
    <p className="settings-footnote">
      {lead}
      {rest && open ? ` ${rest}` : null}
      {rest ? (
        <button
          className="settings-footnote__toggle"
          type="button"
          disabled={disabled || areaDisabled}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? labels.showLess : labels.learnMore}
        </button>
      ) : null}
    </p>
  );
}
