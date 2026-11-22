import type { CSSProperties } from "react";
import { NotchRim, type NotchRimView } from "../../../island/notch-rim/NotchRim";
import { NotchRing, type NotchRingView } from "../../../island/notch-ring/NotchRing";

export const MOCK_NOTCH = { width: 186, height: 32 } as const;
export const MOCK_COLLAPSED_WIDTH = 314;
export const MOCK_EXPANDED = { width: 420, height: 196 } as const;

export type MockGlow = { color: string; reason: string; pulse?: boolean } | null;
export type MockPlayback = { startedAt: number; durationMs: number } | null;

export function NotchMock({
  expanded,
  extra = 0,
  rim,
  ring,
  glow = null,
  playback = null,
  content = false,
}: {
  expanded: boolean;
  extra?: number;
  rim: NotchRimView | null;
  ring: NotchRingView | null;
  glow?: MockGlow;
  playback?: MockPlayback;
  content?: boolean;
}) {
  const width = expanded ? MOCK_EXPANDED.width : MOCK_COLLAPSED_WIDTH;
  const height = expanded ? MOCK_EXPANDED.height : MOCK_NOTCH.height + extra;
  const style = {
    width,
    height,
    "--island-top-fillet": "8px",
    "--island-shell-bottom-corner": expanded ? "30px" : "14px",
    "--island-corner-k": "0.5523",
    "--notch-mock-notch": `${MOCK_NOTCH.width}px`,
  } as CSSProperties;
  const lens = glow?.reason.startsWith("device-use.") ? glow.color : null;

  return (
    <div className={`notch-mock${expanded ? " notch-mock--expanded" : ""}`} style={style} aria-hidden="true">
      {content && (expanded ? <ExpandedContent /> : <CollapsedContent playing={playback !== null} />)}
      {ring && <NotchRing view={ring} expanded={expanded} notch={MOCK_NOTCH} glow={glow} playback={playback} />}
      {rim && <NotchRim view={rim} expanded={expanded} glow={glow} />}
      <span className="notch-mock__lens" style={lens ? { "--notch-mock-light": lens } as CSSProperties : undefined} data-lit={lens ? "" : undefined} />
    </div>
  );
}

function CollapsedContent({ playing }: { playing: boolean }) {
  return (
    <>
      <span className="notch-mock__art notch-mock__art--small" />
      <span className={playing ? "notch-mock__bars" : "notch-mock__dot"} />
    </>
  );
}

function ExpandedContent() {
  return (
    <div className="notch-mock__panel">
      <span className="notch-mock__art" />
      <span className="notch-mock__line notch-mock__line--title" />
      <span className="notch-mock__line notch-mock__line--sub" />
      <span className="notch-mock__track"><span /></span>
      <span className="notch-mock__controls"><i /><i /><i /></span>
    </div>
  );
}
