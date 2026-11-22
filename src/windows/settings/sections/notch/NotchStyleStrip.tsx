import { useEffect, useRef, useState } from "react";
import type { NotchRimLook, NotchRimStyle } from "../../../../lib/settings/notchRimSettings";
import type { NotchRingLook, NotchRingStyle } from "../../../../lib/settings/notchRingSettings";
import type { NotchLayer, NotchShared } from "../../../../lib/settings/notchSettingsModel";
import { MOCK_COLLAPSED_WIDTH, MOCK_NOTCH, NotchMock } from "./NotchMock";
import "./NotchStyleStrip.css";

const THUMB_WIDTH = 96;
const THUMB_SONG = { elapsedMs: 12_000, durationMs: 30_000 } as const;

type Frame = { from: number; to: number };
const FRAMES: Record<NotchLayer, Frame> = {
  rim: { from: MOCK_COLLAPSED_WIDTH / 2 - 8, to: MOCK_COLLAPSED_WIDTH + 18 },
  ring: { from: MOCK_COLLAPSED_WIDTH / 2 - 6, to: MOCK_COLLAPSED_WIDTH / 2 + MOCK_NOTCH.width / 2 + 34 },
};

function Thumb({ layer, style, shared, gap, accent, live }: {
  layer: NotchLayer;
  style: string;
  shared: NotchShared;
  gap: number;
  accent: string;
  live: boolean;
}) {
  const [startedAt] = useState(() => Date.now() - THUMB_SONG.elapsedMs);
  const frame = FRAMES[layer];
  const scale = THUMB_WIDTH / (frame.to - frame.from);
  const base = { ...shared, width: Math.max(shared.width, 1.5), intensity: Math.max(shared.intensity, 70), status: false };
  const rimLook = { ...base, style } as NotchRimLook;
  const ringLook = { ...base, style, gap, device: false, motion: style === "progress" ? false : base.motion } as NotchRingLook;
  const paused = !live;
  return (
    <span className="notch-strip__art">
      <span className="notch-strip__mock" style={{ left: -frame.from * scale, transform: `scale(${scale})` }}>
        <NotchMock
          expanded={false}
          extra={layer === "ring" ? gap + base.width + 2 : 0}
          rim={layer === "rim" ? { island: rimLook, panel: rimLook, accent, paused } : null}
          ring={layer === "ring" ? { island: ringLook, panel: ringLook, accent, paused } : null}
          playback={{ startedAt, durationMs: THUMB_SONG.durationMs }}
        />
      </span>
    </span>
  );
}

export function NotchStyleStrip<S extends NotchRimStyle | NotchRingStyle>({
  layer,
  styles,
  value,
  labels,
  hints,
  plain,
  ariaLabel,
  shared,
  gap,
  accent,
  onChange,
}: {
  layer: NotchLayer;
  styles: readonly S[];
  value: S;
  labels: Record<S, string>;
  hints: Record<S, string>;
  plain: string;
  ariaLabel: string;
  shared: NotchShared;
  gap: number;
  accent: string;
  onChange: (style: S) => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const [live, setLive] = useState<S | null>(null);
  const initial = useRef(value);

  useEffect(() => {
    const strip = stripRef.current;
    const chosen = strip?.querySelector<HTMLElement>(`[data-style="${initial.current}"]`);
    if (strip && chosen && chosen.offsetLeft + chosen.offsetWidth > strip.clientWidth) strip.scrollLeft = chosen.offsetLeft - 8;
  }, []);

  return (
    <div ref={stripRef} className="notch-strip" role="group" aria-label={ariaLabel}>
      {styles.map((style) => {
        const active = style === value;
        return (
          <button
            key={style}
            type="button"
            className={active ? "notch-strip__item notch-strip__item--active" : "notch-strip__item"}
            aria-pressed={active}
            title={hints[style]}
            data-style={style}
            onClick={() => onChange(style)}
            onPointerEnter={() => setLive(style)}
            onPointerLeave={() => setLive((current) => (current === style ? null : current))}
            onFocus={() => setLive(style)}
            onBlur={() => setLive((current) => (current === style ? null : current))}
          >
            {style === "off"
              ? <span className="notch-strip__art notch-strip__art--plain"><span>{plain}</span></span>
              : <Thumb layer={layer} style={style} shared={shared} gap={layer === "ring" ? Math.min(gap, 3) : gap} accent={accent} live={active || live === style} />}
            <span className="notch-strip__label">{labels[style]}</span>
          </button>
        );
      })}
    </div>
  );
}
