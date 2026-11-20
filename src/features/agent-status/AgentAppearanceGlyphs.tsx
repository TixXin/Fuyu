import type { AgentLightStyle } from "../../lib/settings/types";
import type { AgentSessionView } from "./agentSettings";
import "./AgentAppearanceGlyphs.css";

export function LightStyleArt({ style }: { style: AgentLightStyle }) {
  return (
    <span className="agent-glyph agent-glyph--bar">
      <span className="agent-glyph__capsule">
        {style === "mark" ? (
          <svg className="agent-glyph__jelly" viewBox="3 4 58 43" aria-hidden="true">
            <path
              className="agent-glyph__jelly-body"
              d="M5 30.5C5 16 17 7 32 7S59 16 59 30.5c0 3-2.4 5.5-5.4 5.5H51.88A6.6 6.6 0 0 1 41.35 43.68A6.6 6.6 0 0 1 32 43.63A6.6 6.6 0 0 1 22.65 43.68A6.6 6.6 0 0 1 12.12 36H10.4C7.4 36 5 33.5 5 30.5Z"
            />
            <ellipse className="agent-glyph__jelly-eye" cx={24} cy={25} rx={3.2} ry={4.5} />
            <ellipse className="agent-glyph__jelly-eye" cx={40} cy={25} rx={3.2} ry={4.5} />
          </svg>
        ) : (
          <i className="agent-glyph__dot" />
        )}
        <span className="agent-glyph__title-line" />
        <span className="agent-glyph__ring" />
      </span>
    </span>
  );
}

export function SessionViewArt({ view }: { view: AgentSessionView }) {
  if (view === "cards") {
    return (
      <span className="agent-glyph agent-glyph--view">
        <span className="agent-glyph__card">
          <span className="agent-glyph__card-top">
            <b className="agent-glyph__bar agent-glyph__bar--strong" />
            <em className="agent-glyph__pill" />
          </span>
          <span className="agent-glyph__card-bottom">
            <i className="agent-glyph__state-chip" />
            <b className="agent-glyph__bar agent-glyph__bar--short" />
          </span>
        </span>
      </span>
    );
  }

  if (view === "compact") {
    return (
      <span className="agent-glyph agent-glyph--view agent-glyph--stack">
        <span className="agent-glyph__compact-row">
          <i className="agent-glyph__stripe agent-glyph__stripe--needs" />
          <b className="agent-glyph__bar agent-glyph__bar--strong" />
          <s className="agent-glyph__time" />
        </span>
        <span className="agent-glyph__compact-row">
          <i className="agent-glyph__stripe agent-glyph__stripe--turn" />
          <b className="agent-glyph__bar" />
          <s className="agent-glyph__time" />
        </span>
        <span className="agent-glyph__compact-row">
          <i className="agent-glyph__stripe agent-glyph__stripe--work" />
          <b className="agent-glyph__bar agent-glyph__bar--mid" />
          <s className="agent-glyph__time" />
        </span>
      </span>
    );
  }

  return (
    <span className="agent-glyph agent-glyph--view agent-glyph--stack">
      <span className="agent-glyph__list-row">
        <i className="agent-glyph__list-dot agent-glyph__list-dot--work" />
        <span className="agent-glyph__list-lines">
          <b className="agent-glyph__bar agent-glyph__bar--strong" />
          <b className="agent-glyph__bar agent-glyph__bar--soft" />
        </span>
        <s className="agent-glyph__time" />
      </span>
      <span className="agent-glyph__list-row">
        <i className="agent-glyph__list-dot agent-glyph__list-dot--turn" />
        <span className="agent-glyph__list-lines">
          <b className="agent-glyph__bar agent-glyph__bar--mid" />
          <b className="agent-glyph__bar agent-glyph__bar--soft" />
        </span>
        <s className="agent-glyph__time" />
      </span>
    </span>
  );
}
