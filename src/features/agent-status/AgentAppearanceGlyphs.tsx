import type { AgentSessionView } from "./agentSettings";
import "./AgentAppearanceGlyphs.css";

export function SessionViewArt({ view }: { view: AgentSessionView }) {
  if (view === "split") {
    return (
      <span className="agent-glyph agent-glyph--split">
        <span className="agent-glyph__split-left">
          <span className="agent-glyph__split-row agent-glyph__split-row--on"><i className="agent-glyph__list-dot agent-glyph__list-dot--work" /><b className="agent-glyph__bar agent-glyph__bar--strong" /></span>
          <span className="agent-glyph__split-row"><i className="agent-glyph__list-dot agent-glyph__list-dot--turn" /><b className="agent-glyph__bar" /></span>
          <span className="agent-glyph__split-row"><i className="agent-glyph__list-dot" /><b className="agent-glyph__bar agent-glyph__bar--soft" /></span>
        </span>
        <span className="agent-glyph__split-right">
          <b className="agent-glyph__bar agent-glyph__bar--strong" />
          <span className="agent-glyph__split-box" />
          <span className="agent-glyph__split-cta" />
        </span>
      </span>
    );
  }

  if (view === "bento") {
    return (
      <span className="agent-glyph agent-glyph--bento">
        <span className="agent-glyph__bento-spot">
          <i className="agent-glyph__stripe agent-glyph__stripe--needs" />
          <b className="agent-glyph__bar agent-glyph__bar--strong" />
        </span>
        <span className="agent-glyph__bento-grid">
          <span className="agent-glyph__bento-cell">
            <i className="agent-glyph__list-dot agent-glyph__list-dot--work" />
            <b className="agent-glyph__bar agent-glyph__bar--strong" />
            <b className="agent-glyph__bar agent-glyph__bar--soft" />
          </span>
          <span className="agent-glyph__bento-cell">
            <i className="agent-glyph__list-dot agent-glyph__list-dot--turn" />
            <b className="agent-glyph__bar" />
            <b className="agent-glyph__bar agent-glyph__bar--soft" />
          </span>
        </span>
      </span>
    );
  }

  if (view === "projects") {
    return (
      <span className="agent-glyph agent-glyph--projects">
        <span className="agent-glyph__proj-box">
          <span className="agent-glyph__proj-head"><b className="agent-glyph__bar agent-glyph__bar--short" /></span>
          <span className="agent-glyph__proj-row"><i className="agent-glyph__list-dot agent-glyph__list-dot--work" /><b className="agent-glyph__bar agent-glyph__bar--strong" /></span>
          <span className="agent-glyph__proj-row"><i className="agent-glyph__list-dot" /><b className="agent-glyph__bar agent-glyph__bar--soft" /></span>
        </span>
      </span>
    );
  }

  if (view === "minimal") {
    return (
      <span className="agent-glyph agent-glyph--stack">
        <span className="agent-glyph__compact-row agent-glyph__compact-row--on">
          <i className="agent-glyph__list-dot agent-glyph__list-dot--work" />
          <b className="agent-glyph__bar agent-glyph__bar--strong" />
          <s className="agent-glyph__time" />
        </span>
        <span className="agent-glyph__compact-row">
          <i className="agent-glyph__list-dot agent-glyph__list-dot--turn" />
          <b className="agent-glyph__bar" />
          <s className="agent-glyph__time" />
        </span>
        <span className="agent-glyph__compact-row">
          <i className="agent-glyph__list-dot" />
          <b className="agent-glyph__bar agent-glyph__bar--mid" />
          <s className="agent-glyph__time" />
        </span>
      </span>
    );
  }

  return (
    <span className="agent-glyph agent-glyph--stack">
      <span className="agent-glyph__focused-card">
        <i className="agent-glyph__stripe agent-glyph__stripe--work" />
        <span className="agent-glyph__list-lines">
          <b className="agent-glyph__bar agent-glyph__bar--strong" />
          <b className="agent-glyph__bar agent-glyph__bar--soft" />
        </span>
      </span>
      <span className="agent-glyph__compact-row">
        <i className="agent-glyph__list-dot" />
        <b className="agent-glyph__bar agent-glyph__bar--mid" />
        <s className="agent-glyph__time" />
      </span>
    </span>
  );
}
