import { useState } from "react";
import type { PanelIconComponent } from "../../../../components/island-widget/panelIcons";
import { SettingsSwitch } from "../../../../components/settings/SettingsSwitch";
import { useTranslation } from "../../../../i18n";
import { isMacOS } from "../../../../lib/platform";
import { firstEmoji, formatPageIcon, graphemes, parsePageIcon } from "../../../../lib/settings/pageIconValue";
import { EMOJI_CHOICES } from "./emojiChoices";
import { IconCell, type CellHandlers } from "./IconCell";
import { useGridKeys } from "./useGridKeys";

type EmojiSourceTabProps = CellHandlers & { glyph: (value: string) => PanelIconComponent };

export function EmojiSourceTab({ glyph, ...cell }: EmojiSourceTabProps) {
  const text = useTranslation().settings.islandPages.icons.picker.emoji;
  const parsed = parsePageIcon(cell.current);
  const chosen = parsed?.kind === "emoji" ? parsed : null;
  const [draft, setDraft] = useState(chosen?.emoji ?? "");
  const [note, setNote] = useState<{ text: string; warn: boolean } | null>(null);
  const [mono, setMono] = useState(chosen?.mono ?? false);
  const onKeys = useGridKeys();
  const valueOf = (emoji: string) => formatPageIcon({ kind: "emoji", emoji, mono });

  const type = (input: string) => {
    setDraft(input);
    if (!input.trim()) {
      setNote(null);
      return;
    }
    const emoji = firstEmoji(input);
    if (!emoji) {
      setNote({ text: text.notEmoji, warn: true });
      return;
    }
    setNote(graphemes(input.trim()).length > 1 ? { text: text.onlyFirst(emoji), warn: false } : null);
    cell.onPick(valueOf(emoji));
  };

  return (
    <div className="page-icon-tab" onKeyDown={onKeys}>
      <div className="page-icon-row">
        <input
          className="page-icon-input page-icon-input--big"
          value={draft}
          placeholder="🐙"
          aria-label={text.label}
          onChange={(event) => type(event.currentTarget.value)}
        />
        <div className="page-icon-row__text">
          <span className="page-icon-note">{text.hint}<kbd>{isMacOS ? text.keys.mac : text.keys.windows}</kbd></span>
          {note ? <span className={note.warn ? "page-icon-note page-icon-note--warn" : "page-icon-note"} role="status">{note.text}</span> : null}
        </div>
        <label className="page-icon-switch">
          <SettingsSwitch
            id="page-icon-emoji-mono"
            checked={mono}
            onChange={(next) => {
              setMono(next);
              if (chosen) cell.onPick(formatPageIcon({ ...chosen, mono: next }));
            }}
          />
          <span>{text.mono}</span>
        </label>
      </div>
      {EMOJI_CHOICES.map(([group, emojis]) => (
        <div key={group}>
          <div className="page-icon-section">{text.groups[group]}</div>
          <div className="page-icon-grid" role="radiogroup" aria-label={text.groups[group]}>
            {emojis.map((emoji) => {
              const value = valueOf(emoji);
              return <IconCell key={emoji} value={value} label={emoji} icon={glyph(value)} {...cell} onPick={(next) => {
                setDraft(emoji);
                setNote(null);
                cell.onPick(next);
              }} />;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
