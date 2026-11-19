import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../i18n";
import { setIslandOverflowRect } from "./api";
import { collapsedFit } from "./collapsedFitStore";
import { MORE_CHIP_CLASS } from "./useCollapsedOverflow";
import type { IslandPage } from "./types";
import "./CollapsedMore.css";

export type CollapsedMoreRow = { id: string; name: string; page: IslandPage | null };

const OPEN_DELAY_MS = 150;
const CLOSE_DELAY_MS = 220;
const PANEL_OFFSET = 6;
const EDGE = 8;
const CHIP_FIT_ID = "overflow:chip";
const CHIP_FIT_WIDTH = 28;

type Place = { top: number; left: number | null; center: number; root: Element };

export function CollapsedMore({ rows, onOpenPage, reserve = false }: { rows: readonly CollapsedMoreRow[]; onOpenPage: (page: IslandPage) => void; reserve?: boolean }) {
  const copy = useTranslation().island;
  const chipRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const [place, setPlace] = useState<Place | null>(null);
  const open = place !== null;

  const cancel = () => window.clearTimeout(timerRef.current);
  const show = useCallback(() => {
    const chip = chipRef.current;
    if (!chip) return;
    const anchor = chip.getBoundingClientRect();
    const island = (chip.closest(".island") ?? chip).getBoundingClientRect();
    setPlace({ top: island.bottom + PANEL_OFFSET, left: null, center: anchor.left + anchor.width / 2, root: chip.closest(".stage") ?? document.body });
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setPlace(null);
  }, []);
  const later = (run: () => void, delay: number) => {
    cancel();
    timerRef.current = window.setTimeout(run, delay);
  };

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (!reserve) return;
    collapsedFit.report(CHIP_FIT_ID, CHIP_FIT_WIDTH);
    return () => collapsedFit.drop(CHIP_FIT_ID);
  }, [reserve]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!place || !panel || place.left !== null) return;
    const width = panel.getBoundingClientRect().width;
    const left = Math.max(EDGE, Math.min(place.center - width / 2, window.innerWidth - width - EDGE));
    setPlace({ ...place, left });
  }, [place]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const send = () => {
      const rect = panel.getBoundingClientRect();
      void setIslandOverflowRect({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(() => undefined);
    };
    send();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(send);
    observer?.observe(panel);
    return () => {
      observer?.disconnect();
      void setIslandOverflowRect(null).catch(() => undefined);
    };
  }, [open, place?.left]);

  const pick = (row: CollapsedMoreRow) => {
    hide();
    if (row.page) onOpenPage(row.page);
  };
  const onChipKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      hide();
    } else if (event.key === "ArrowDown" && open) {
      event.preventDefault();
      panelRef.current?.querySelector<HTMLElement>("button")?.focus();
    }
  };
  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      hide();
      chipRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...(panelRef.current?.querySelectorAll<HTMLElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLElement);
    buttons[(at + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % Math.max(buttons.length, 1)]?.focus();
  };

  return (
    <>
      <button
        ref={chipRef}
        className={MORE_CHIP_CLASS}
        type="button"
        aria-label={copy.overflowMore(rows.length)}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerEnter={() => later(show, OPEN_DELAY_MS)}
        onPointerLeave={() => later(hide, CLOSE_DELAY_MS)}
        onClick={(event) => {
          event.stopPropagation();
          cancel();
          if (open) hide();
          else show();
        }}
        onKeyDown={onChipKey}
      >
        +{rows.length}
      </button>
      {place && createPortal(
        <div
          ref={panelRef}
          className="island-more-panel"
          role="menu"
          aria-label={copy.overflowPanel}
          style={{ top: place.top, left: place.left ?? place.center, visibility: place.left === null ? "hidden" : undefined }}
          onPointerEnter={cancel}
          onPointerLeave={() => later(hide, CLOSE_DELAY_MS)}
          onKeyDown={onPanelKey}
        >
          {rows.map((row) => row.page ? (
            <button key={row.id} className="island-more-panel__row" type="button" role="menuitem" onClick={() => pick(row)}>{row.name}</button>
          ) : (
            <span key={row.id} className="island-more-panel__row island-more-panel__row--plain" role="menuitem" aria-disabled="true">{row.name}</span>
          ))}
        </div>,
        place.root,
      )}
    </>
  );
}
