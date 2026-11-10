import { useEffect, useMemo, useRef, useState } from "react";
import { WandSparkles } from "lucide-react";
import { useTranslation } from "../../i18n";
import { convertChineseText, type ClipboardHistoryItem } from "./api";
import { htmlToMarkdown } from "./htmlToMarkdown";
import { TRANSFORMS, type Transform, type TransformInput } from "./textTransforms";

/** The transformed text, or null when the transform does not apply; Chinese scripts ask Windows. */
export async function transformText(transform: Transform, input: TransformInput): Promise<string | null> {
  if (transform.block?.(input)) return null;
  if (transform.id === "simplified" || transform.id === "traditional") return convertChineseText(input.text, transform.id);
  if (transform.id === "markdown") return input.html ? htmlToMarkdown(input.html) : null;
  return transform.run(input);
}

/**
 * The actions panel's second page (C38): every local transform, the ones that would not change
 * this text greyed out with why, and what the picked one would paste. ↑↓ pick, Enter or a click
 * pastes, 1–9 paste that one.
 */
export function ClipboardTransformList({ item, query, onPaste }: { item: ClipboardHistoryItem; query: string; onPaste: (text: string) => void }) {
  const t = useTranslation();
  const text = t.clipboard.popup.actions;
  const input = useMemo<TransformInput>(() => ({ text: item.text ?? item.preview, html: item.html }), [item]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TRANSFORMS.filter((transform) => !needle || text.transforms[transform.id].toLowerCase().includes(needle))
      .map((transform) => ({ transform, block: transform.block?.(input) ?? null }));
  }, [input, query, text]);
  const firstOpen = Math.max(0, rows.findIndex((row) => !row.block));
  const [selected, setSelected] = useState(firstOpen);
  const current = Math.min(selected, Math.max(0, rows.length - 1));
  const [result, setResult] = useState<string | null>(null);
  const row = rows[current];
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => setSelected(firstOpen), [firstOpen]);
  useEffect(() => {
    if (!row || row.block || row.transform.id === "simplified" || row.transform.id === "traditional") {
      setResult(null);
      return;
    }
    let cancelled = false;
    void transformText(row.transform, input).then((next) => { if (!cancelled) setResult(next); }, () => !cancelled && setResult(null));
    return () => { cancelled = true; };
  }, [row, input]);

  const paste = (index: number) => {
    const picked = rows[index];
    if (!picked || picked.block) return;
    void transformText(picked.transform, input).then((next) => next !== null && onPaste(next), (error: unknown) => console.error("Failed to transform the entry", error));
  };

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setSelected((index) => (Math.min(index, rows.length - 1) + step + rows.length) % Math.max(1, rows.length));
      } else if (event.key === "Enter") {
        event.preventDefault();
        paste(current);
      } else if (/^[1-9]$/.test(event.key) && !event.ctrlKey && !event.altKey && query === "") {
        event.preventDefault();
        paste(Number(event.key) - 1);
      }
    };
    // Capture on the panel: its own handler stops keys on their way up.
    const panel = listRef.current?.closest(".clipboard-panel");
    panel?.addEventListener("keydown", onKey as EventListener, true);
    return () => panel?.removeEventListener("keydown", onKey as EventListener, true);
  });

  const native = row && (row.transform.id === "simplified" || row.transform.id === "traditional");
  return (
    <>
      <ul ref={listRef} className="clipboard-panel__list" role="listbox" aria-label={text.transformTitle}>
        {rows.map(({ transform, block }, index) => (
          <li key={transform.id} role="presentation">
            <button
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={index === current}
              aria-disabled={Boolean(block)}
              data-action={transform.id}
              className={`clipboard-panel__action${index === current ? " clipboard-panel__action--selected" : ""}${block ? " clipboard-panel__action--off" : ""}`}
              onPointerMove={() => index !== current && setSelected(index)}
              onClick={() => paste(index)}
            >
              <WandSparkles size={14} strokeWidth={1.9} aria-hidden="true" />
              <span className="clipboard-panel__label">{text.transforms[transform.id]}</span>
              {block && <span className="clipboard-panel__note">{text.blocks[block]}</span>}
              {index < 9 && query === "" && <kbd>{index + 1}</kbd>}
            </button>
          </li>
        ))}
      </ul>
      {row && !row.block && (
        <div className="clipboard-panel__result" role="status">
          <span>{text.result}</span>
          <pre>{native ? text.resultNative : result ?? ""}</pre>
        </div>
      )}
    </>
  );
}
