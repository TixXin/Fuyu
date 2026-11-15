import { useTranslation } from "../../i18n";
import type { ClipboardHistoryItem } from "./api";
import { ALT_KEY, PIN_KEYS, pinOwners } from "./pins";

export function ClipboardPinKeyPage({ item, items, onSet }: {
  item: ClipboardHistoryItem;
  items: readonly ClipboardHistoryItem[];
  onSet: (key: string | null) => void;
}) {
  const t = useTranslation();
  const text = t.clipboardList;
  const owners = pinOwners(items);
  const current = item.favorite ? item.pinKey : undefined;
  const label = (entry: ClipboardHistoryItem) => (entry.kind === "image" ? t.clipboard.imageLabel(entry.image?.width ?? 0, entry.image?.height ?? 0) : [...entry.preview].slice(0, 20).join(""));
  return (
    <div className="clipboard-pinkey">
      <p className="clipboard-pinkey__hint">{current ? text.pinKeyHint(`${ALT_KEY}${current}`) : text.pinKeyNone}</p>
      <div className="clipboard-pinkey__grid" role="group" aria-label={text.pinKeyTitle}>
        {PIN_KEYS.map((key) => {
          const owner = owners.get(key);
          const other = owner && owner.id !== item.id ? owner : undefined;
          return (
            <button
              key={key}
              type="button"
              tabIndex={-1}
              aria-pressed={key === current}
              className={`clipboard-pinkey__key${key === current ? " clipboard-pinkey__key--on" : ""}${other ? " clipboard-pinkey__key--taken" : ""}`}
              title={other ? text.pinKeyTaken(label(other)) : undefined}
              onClick={() => onSet(key)}
            >
              {key}
            </button>
          );
        })}
      </div>
      <div className="clipboard-pinkey__foot">
        <span>{text.pinKeyReserved}</span>
        {current && (
          <button type="button" tabIndex={-1} className="clipboard-pinkey__clear" onClick={() => onSet(null)}>
            <kbd>⌫</kbd>{text.pinKeyClear}
          </button>
        )}
      </div>
    </div>
  );
}
