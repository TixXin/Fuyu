import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

type LevelSliderProps = {
  level: number | null;
  label: string;
  title: string;
  settable: boolean;
  sendEveryMs: number;
  muted?: boolean;
  onLevel: (level: number) => void;
  onSend: (level: number) => void;
  onDragging?: (dragging: boolean) => void;
  children: ReactNode;
};

const clamp = (level: number) => Math.min(1, Math.max(0, level));

export function LevelSlider({ level, label, title, settable, sendEveryMs, muted, onLevel, onSend, onDragging, children }: LevelSliderProps) {
  const sent = useRef(0);
  const active = settable && level !== null;
  const percent = Math.round((level ?? 0) * 100);
  const change = (next: number, force = false) => {
    const value = clamp(next);
    onLevel(value);
    const now = Date.now();
    if (!force && now - sent.current < sendEveryMs) return;
    sent.current = now;
    onSend(value);
  };
  const levelAt = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return 1 - (event.clientY - box.top) / box.height;
  };
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!active) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    onDragging?.(true);
    change(levelAt(event), true);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) change(levelAt(event));
  };
  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    change(levelAt(event), true);
    onDragging?.(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!active || level === null) return;
    const step = event.key === "ArrowUp" || event.key === "ArrowRight" ? 0.05 : event.key === "ArrowDown" || event.key === "ArrowLeft" ? -0.05 : 0;
    if (!step) return;
    event.preventDefault();
    change(level + step, true);
  };
  if (!settable) {
    return (
      <div className="levels-widget__slider" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} title={title} data-readonly="true" data-off={level === null || undefined}>
        <b style={{ height: `${percent}%` }} />
        {children}
      </div>
    );
  }
  return (
    <div
      className="levels-widget__slider"
      role="slider"
      tabIndex={active ? 0 : -1}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-disabled={!active || undefined}
      title={title}
      data-muted={muted || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      <b style={{ height: `${percent}%` }} />
      {children}
    </div>
  );
}
