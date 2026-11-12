import type { StageState } from "./stageState";

export function Caption({ caption }: { caption: StageState["caption"] }) {
  return (
    <div className="caption-layer">
      {caption && (
        <p key={caption.id} className="caption">
          {caption.kicker && <span className="caption__kicker">{caption.kicker}</span>}
          <span className="caption__text">{caption.text}</span>
        </p>
      )}
    </div>
  );
}
