import type { StageState } from "./stageState";

export function Cursor({ cursor }: { cursor: StageState["cursor"] }) {
  return (
    <div
      className={`cursor${cursor.visible ? " cursor--visible" : ""}${cursor.pressed ? " cursor--pressed" : ""}`}
      style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transitionDuration: `${cursor.ms}ms, 200ms` }}
    >
      <i className="cursor__ring" />
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3 L5 19.5 L9.4 15.6 L12.3 22 L15 20.8 L12.1 14.5 L18 14.2 Z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
