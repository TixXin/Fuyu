import { useState } from "react";
import { useTranslation } from "../../i18n";
import { splitLead } from "../../utils/splitLead";
import "./SettingsFootnote.css";

export function SettingsFootnote({ text }: { text: string }) {
  const labels = useTranslation().common;
  const [open, setOpen] = useState(false);
  const [lead, rest] = splitLead(text);

  return (
    <p className="settings-footnote">
      {lead}
      {rest && open ? ` ${rest}` : null}
      {rest ? (
        <button className="settings-footnote__toggle" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? labels.showLess : labels.learnMore}
        </button>
      ) : null}
    </p>
  );
}
