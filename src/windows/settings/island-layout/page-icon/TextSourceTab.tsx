import { useEffect, useRef, useState } from "react";
import { SettingsChoice } from "../../../../components/settings/SettingsChoice";
import { useTranslation } from "../../../../i18n";
import { clampPageText, formatPageIcon, graphemes, parsePageIcon } from "../../../../lib/settings/pageIconValue";

const TOO_WIDE = 30;

type TextSourceTabProps = { current: string; pageName: string; onPick: (value: string) => void; onClear: () => void };

let measureContext: CanvasRenderingContext2D | null = null;

function measure(value: string, bold: boolean, font: string): number {
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return 0;
  measureContext.font = `${bold ? 700 : 500} 13px ${font}`;
  return Math.round(measureContext.measureText(value).width);
}

function suggestionsFor(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const chars = graphemes(name.replace(/\s+/g, ""));
  const list = [clampPageText(chars[0] ?? ""), clampPageText(name.replace(/\s+/g, "")), clampPageText(words.map((word) => graphemes(word)[0]).join("")), clampPageText(chars[chars.length - 1] ?? "")];
  return [...new Set(list.filter(Boolean))];
}

export function TextSourceTab({ current, pageName, onPick, onClear }: TextSourceTabProps) {
  const text = useTranslation().settings.islandPages.icons.picker.text;
  const parsed = parsePageIcon(current);
  const chosen = parsed?.kind === "text" ? parsed : null;
  const [draft, setDraft] = useState(chosen?.text ?? "");
  const [bold, setBold] = useState(chosen?.bold ?? true);
  const composing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [font, setFont] = useState("sans-serif");

  useEffect(() => {
    if (inputRef.current) setFont(getComputedStyle(inputRef.current).fontFamily || "sans-serif");
    inputRef.current?.focus();
  }, []);

  const commit = (raw: string, weight = bold) => {
    const value = clampPageText(raw);
    setDraft(value);
    if (value) onPick(formatPageIcon({ kind: "text", text: value, bold: weight }));
    else if (chosen) onClear();
  };

  const width = draft ? measure(draft, bold, font) : 0;

  return (
    <div className="page-icon-tab">
      <div className="page-icon-row">
        <input
          ref={inputRef}
          className="page-icon-input page-icon-input--big"
          value={draft}
          placeholder={graphemes(pageName)[0] ?? ""}
          aria-label={text.label}
          aria-describedby="page-icon-text-hint"
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            commit(event.currentTarget.value);
          }}
          onChange={(event) => {
            if (composing.current) setDraft(event.currentTarget.value);
            else commit(event.currentTarget.value);
          }}
        />
        <SettingsChoice
          value={bold ? "bold" : "regular"}
          ariaLabel={text.weight}
          options={[{ value: "regular", label: text.regular }, { value: "bold", label: text.bold }]}
          onChange={(next) => {
            setBold(next === "bold");
            if (draft) commit(draft, next === "bold");
          }}
        />
      </div>
      <p id="page-icon-text-hint" className={width > TOO_WIDE ? "page-icon-note page-icon-note--warn" : "page-icon-note"} aria-live="polite">
        {draft ? (width > TOO_WIDE ? text.tooWide(width) : text.width(width)) : text.hint}
      </p>
      <div className="page-icon-section">{text.suggestions}</div>
      <div className="page-icon-chips">
        {suggestionsFor(pageName).map((value) => (
          <button key={value} type="button" className="page-icon-chip" aria-pressed={chosen?.text === value} onClick={() => commit(value)}>
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}
