import type { AgentUsageLayout } from "./agentSettings";
import "./AgentUsageLayoutArt.css";

const LEVELS = ["low", "medium", "high"] as const;

export function AgentUsageLayoutArt({ layout }: { layout: AgentUsageLayout }) {
  if (layout === "strip") {
    return (
      <span className="usage-art usage-art--strip">
        {LEVELS.map((level) => <i key={level} className={`usage-art__strip usage-art--${level}`} />)}
      </span>
    );
  }
  if (layout === "chips") {
    return (
      <span className="usage-art usage-art--chips">
        {LEVELS.map((level) => <i key={level} className={`usage-art__pill usage-art--${level}`} />)}
      </span>
    );
  }
  if (layout === "tiles") {
    return (
      <span className="usage-art usage-art--tiles">
        {LEVELS.map((level) => <i key={level} className={`usage-art__tile usage-art--${level}`} />)}
      </span>
    );
  }
  if (layout === "lead") {
    return (
      <span className="usage-art usage-art--lead">
        <i className="usage-art__track usage-art--high" />
        <span className="usage-art__dots">{LEVELS.map((level) => <i key={level} className={`usage-art__dot usage-art--${level}`} />)}</span>
      </span>
    );
  }
  if (layout === "ruler") {
    return (
      <span className="usage-art usage-art--ruler">
        <i className="usage-art__scale" />
        {[18, 52, 88].map((spot) => <i key={spot} className="usage-art__pin" style={{ left: `${spot}%` }} />)}
      </span>
    );
  }
  return (
    <span className="usage-art usage-art--table">
      {LEVELS.map((level) => <i key={level} className={`usage-art__line usage-art--${level}`} />)}
    </span>
  );
}
