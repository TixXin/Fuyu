import type { AgentLightStyle } from "../../lib/settings/types";
import type { AgentSessionView } from "./agentSettings";
import "./AgentAppearanceGlyphs.css";

export function LightStyleArt({ style }: { style: AgentLightStyle }) {
  return (
    <span className="agent-glyph agent-glyph--bar">
      <span className="agent-glyph__capsule">
        {style === "mark" ? (
          <span className="agent-glyph__mark">
            <i className="agent-glyph__mark-dot" />
            <b className="agent-glyph__mark-dots" />
          </span>
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
