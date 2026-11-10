import { useMemo, useState, type KeyboardEvent } from "react";
import {
  ClipboardPaste, CornerDownLeft, FileText, ImageIcon, Pause, Pencil, Play, QrCode, Search, SkipForward, Sparkles, Star, Tag, TextQuote, Trash2, Type, WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import type { ClipboardAiPrompt, ClipboardHistoryItem } from "./api";
import { ClipboardAiList } from "./ClipboardAiList";
import { ClipboardTransformList } from "./ClipboardTransformList";
import { filterActions, type ActionIcon, type PopupAction } from "./popupActions";

const ICONS: Record<ActionIcon, LucideIcon> = {
  paste: ClipboardPaste, plain: Type, enter: CornerDownLeft, edit: Pencil, wand: WandSparkles, file: FileText, image: ImageIcon,
  qr: QrCode, ai: Sparkles, star: Star, tag: Tag, snippet: TextQuote, trash: Trash2, pause: Pause, play: Play, skip: SkipForward,
};

export type PanelPage = "actions" | "transforms" | "note" | "ai";

/**
 * The clipboard window's actions panel (C38), opened by Ctrl+K or a right click over the list:
 * everything the island's page can do with an entry, transforms, and pausing the history. Typing
 * narrows the actions; ↑↓ and Enter pick one; Esc goes back a page, then closes.
 */
export function ClipboardActionPanel({ item, actions, page, aiPrompts, copy = false, onPage, onClose, onPasteText, onSaveNote }: {
  item?: ClipboardHistoryItem;
  actions: readonly PopupAction[];
  page: PanelPage;
  onPage: (page: PanelPage) => void;
  onClose: () => void;
  onPasteText: (text: string) => void;
  onSaveNote: (id: string, note: string) => void;
  aiPrompts?: readonly ClipboardAiPrompt[];
  /** On the island's page (C43): the transform and AI pages copy the result instead of pasting it. */
  copy?: boolean;
}) {
  const t = useTranslation();
  const popupText = t.clipboard.popup.actions;
  const text = copy ? { ...popupText, ...popupText.copy } : popupText;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [note, setNote] = useState(() => [item?.note ?? "", ...(item?.tags ?? []).map((tag) => `#${tag}`)].join(" ").trim());
  const shown = useMemo(() => filterActions(actions, query), [actions, query]);
  const current = Math.min(selected, Math.max(0, shown.length - 1));

  const run = (action: PopupAction | undefined) => {
    if (!action) return;
    if (action.next) {
      setQuery("");
      setSelected(0);
      onPage(action.next);
      return;
    }
    onClose();
    action.run?.();
  };
  const back = () => {
    if (page === "actions") onClose();
    else {
      setQuery("");
      onPage("actions");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === "Escape" || (event.key === "k" && event.ctrlKey)) {
      event.preventDefault();
      back();
      return;
    }
    if (page !== "actions") return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setSelected((current + step + shown.length) % Math.max(1, shown.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(shown[current]);
    }
  };

  const title = page === "ai" ? text.aiTitle : page === "transforms" ? text.transformTitle : page === "note" ? text.note : text.panelTitle;
  const preview = item ? (item.kind === "image" ? t.clipboard.imageLabel(item.image?.width ?? 0, item.image?.height ?? 0) : item.preview) : "";

  return (
    <div className="clipboard-panel" role="dialog" aria-label={text.panelLabel} onKeyDown={onKeyDown}>
      <div className="clipboard-panel__scrim" aria-hidden="true" onClick={onClose} />
      <div className="clipboard-panel__box">
        <div className="clipboard-panel__head">
          {page === "note" ? <Tag size={13} aria-hidden="true" /> : <Search size={13} aria-hidden="true" />}
          {page === "note" && item ? (
            <input
              autoFocus
              value={note}
              aria-label={text.note}
              placeholder={text.notePlaceholder}
              onChange={(event) => setNote(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  onSaveNote(item.id, note);
                  onPage("actions");
                }
              }}
            />
          ) : (
            <input
              autoFocus
              value={query}
              aria-label={text.panelSearch}
              placeholder={`${title}${preview ? ` · ${preview}` : ""}`}
              onChange={(event) => {
                setQuery(event.currentTarget.value);
                setSelected(0);
              }}
            />
          )}
          <kbd>Esc</kbd>
        </div>
        {page === "ai" && item ? (
          <ClipboardAiList item={item} prompts={aiPrompts} copy={copy} onPaste={(result) => { onClose(); onPasteText(result); }} />
        ) : page === "transforms" && item ? (
          <ClipboardTransformList item={item} query={query} copy={copy} onPaste={(result) => { onClose(); onPasteText(result); }} />
        ) : page === "actions" ? (
          <ul className="clipboard-panel__list" role="listbox" aria-label={text.panelTitle}>
            {shown.length === 0 && <li className="clipboard-panel__none">{text.noActions}</li>}
            {shown.map((action, index) => {
              const Icon = ICONS[action.icon];
              const firstOfGroup = index === 0 || shown[index - 1].group !== action.group;
              return (
                <li key={action.id} role="presentation">
                  {firstOfGroup && <span className="clipboard-panel__group">{text.groups[action.group]}</span>}
                  <button
                    type="button"
                    role="option"
                    tabIndex={-1}
                    aria-selected={index === current}
                    className={`clipboard-panel__action${index === current ? " clipboard-panel__action--selected" : ""}`}
                    data-action={action.id}
                    onPointerMove={() => index !== current && setSelected(index)}
                    onClick={() => run(action)}
                  >
                    <Icon size={14} strokeWidth={1.9} aria-hidden="true" />
                    <span className="clipboard-panel__label">{action.label}</span>
                    {action.note && <span className="clipboard-panel__note">{action.note}</span>}
                    {action.keys && <kbd>{action.keys}</kbd>}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
