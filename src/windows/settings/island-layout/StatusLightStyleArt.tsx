import type { AgentLightStyle } from "../../../lib/settings/types";
import "./StatusLightStyleArt.css";

export function StatusLightStyleArt({ style }: { style: AgentLightStyle }) {
  return (
    <span className="status-light-art">
      <span className="status-light-art__capsule">
        {style === "mark" ? (
          <svg className="status-light-art__jelly" viewBox="3 4 58 43" aria-hidden="true">
            <path
              className="status-light-art__jelly-body"
              d="M5 30.5C5 16 17 7 32 7S59 16 59 30.5c0 3-2.4 5.5-5.4 5.5H51.88A6.6 6.6 0 0 1 41.35 43.68A6.6 6.6 0 0 1 32 43.63A6.6 6.6 0 0 1 22.65 43.68A6.6 6.6 0 0 1 12.12 36H10.4C7.4 36 5 33.5 5 30.5Z"
            />
            <ellipse className="status-light-art__jelly-eye" cx={24} cy={25} rx={3.2} ry={4.5} />
            <ellipse className="status-light-art__jelly-eye" cx={40} cy={25} rx={3.2} ry={4.5} />
          </svg>
        ) : (
          <i className="status-light-art__dot" />
        )}
        <span className="status-light-art__title-line" />
        <span className="status-light-art__ring" />
      </span>
    </span>
  );
}
