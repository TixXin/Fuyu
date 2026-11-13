import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslation } from "../../i18n";
import { releaseNoteLines } from "./releaseNotes";

export function UpdateNotes({ notes, version }: { notes: string; version: string }) {
  const text = useTranslation().settings.project.update;
  const { locale } = useLocale();
  const lines = useMemo(() => {
    const all = releaseNoteLines(notes, locale);
    return all[0]?.kind === "heading" ? all.slice(1) : all;
  }, [notes, locale]);
  const [open, setOpen] = useState(true);
  const id = useId();

  if (lines.length === 0) return null;

  return (
    <div className={open ? "update-notes update-notes--open" : "update-notes"}>
      <button className="update-notes__toggle" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span>{text.notesTitle(version)}</span>
        <small>{open ? text.notesHide : text.notesShow}</small>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="update-notes__body" id={id}>
          {lines.map((line, index) => (
            <p key={index} className={`update-notes__${line.kind}`}>{line.text}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
