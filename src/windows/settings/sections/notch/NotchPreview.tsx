import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { NotchRimView } from "../../../island/notch-rim/NotchRim";
import type { NotchRingView } from "../../../island/notch-ring/NotchRing";
import { NotchMock, type MockGlow, type MockPlayback } from "./NotchMock";

const CANVAS = { width: 480, height: 236 } as const;

export function NotchPreview({
  expanded,
  extra,
  rim,
  ring,
  glow,
  playback,
}: {
  expanded: boolean;
  extra: number;
  rim: NotchRimView | null;
  ring: NotchRingView | null;
  glow: MockGlow;
  playback: MockPlayback;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setScale(Math.min(1, stage.clientWidth / CANVAS.width));
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={stageRef} className="notch-preview" style={{ height: Math.round(CANVAS.height * scale) } as CSSProperties} aria-hidden="true">
      <div className="notch-preview__canvas" style={{ width: CANVAS.width, height: CANVAS.height, transform: `translateX(-50%) scale(${scale})` }}>
        <NotchMock expanded={expanded} extra={extra} rim={rim} ring={ring} glow={glow} playback={playback} content />
      </div>
    </div>
  );
}
