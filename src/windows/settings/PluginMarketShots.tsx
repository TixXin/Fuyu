import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MarketPluginScreenshot } from "@fuyu/plugin-services";
import { useLocale, useTranslation } from "../../i18n";
import { localized } from "./pluginMarketModel";

function ShotViewer({ shots, index, title, host, onIndex, onClose }: {
  shots: readonly MarketPluginScreenshot[];
  index: number;
  title: string;
  host: HTMLElement;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().settings.pluginsV3.marketPage.detail.viewer;
  const viewerRef = useRef<HTMLDivElement>(null);
  const shot = shots[index];
  const caption = localized(shot.caption, locale, "");
  const many = shots.length > 1;

  useEffect(() => {
    viewerRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      const step = event.key === "ArrowRight" ? 1 : -1;
      onIndex(Math.min(shots.length - 1, Math.max(0, index + step)));
    } else if (event.key === "Tab") {
      event.stopPropagation();
      const items = [...(viewerRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (items.length === 0) return;
      const at = items.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      items[(at + (event.shiftKey ? items.length - 1 : 1)) % items.length].focus();
    }
  };

  return createPortal(
    <div ref={viewerRef} className="market-viewer" role="dialog" aria-modal="true" aria-label={`${title} · ${text.label}`} data-market-viewer={index} onKeyDown={onKeyDown} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="market-viewer__bar">
        <span>{many ? text.position(index + 1, shots.length) : null}</span>
        <button className="market-viewer__btn" type="button" aria-label={text.close} title={text.close} data-autofocus onClick={onClose}>
          <X size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <div className="market-viewer__stage" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        {many ? (
          <button className="market-viewer__btn" type="button" aria-label={text.prev} title={text.prev} disabled={index === 0} data-viewer-step="prev" onClick={() => onIndex(index - 1)}>
            <ChevronLeft size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : <span />}
        <img src={shot.url} alt={caption || title} draggable={false} />
        {many ? (
          <button className="market-viewer__btn" type="button" aria-label={text.next} title={text.next} disabled={index === shots.length - 1} data-viewer-step="next" onClick={() => onIndex(index + 1)}>
            <ChevronRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        ) : <span />}
      </div>
      <p className="market-viewer__caption">{caption}</p>
    </div>,
    host,
  );
}

export function PluginMarketShots({ shots, title }: { shots: readonly MarketPluginScreenshot[]; title: string }) {
  const { locale } = useLocale();
  const copy = useTranslation().settings.pluginsV3.marketPage.detail;
  const stripRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ index: number; host: HTMLElement } | null>(null);
  const close = () => {
    const from = open?.index;
    setOpen(null);
    if (from !== undefined) requestAnimationFrame(() => stripRef.current?.querySelector<HTMLElement>(`[data-shot='${from}']`)?.focus());
  };
  if (shots.length === 0) return null;
  return (
    <div ref={stripRef} className="market-shots" role="group" aria-label={copy.screenshots}>
      {shots.map((shot, index) => {
        const caption = localized(shot.caption, locale, "");
        return (
          <figure key={`${shot.url}-${index}`} className="market-shot">
            <button className="market-shot__open" type="button" aria-label={copy.zoomShot(index + 1, shots.length)} data-shot={index} onClick={(event) => setOpen({ index, host: event.currentTarget.closest<HTMLElement>(".settings-stage") ?? document.body })}>
              <img src={shot.url} alt={caption || title} loading="lazy" draggable={false} />
            </button>
            {caption ? <figcaption>{caption}</figcaption> : null}
          </figure>
        );
      })}
      {open && shots[open.index] ? <ShotViewer shots={shots} index={open.index} title={title} host={open.host} onIndex={(index) => setOpen({ ...open, index })} onClose={close} /> : null}
    </div>
  );
}
