export type EndCardCopy = { name: string; latin: string; tagline: string; facts: string[]; url: string };

export function EndCard({ copy, visible }: { copy: EndCardCopy; visible: boolean }) {
  return (
    <div className={`end-card${visible ? " end-card--visible" : ""}`}>
      <div className="end-card__pill">
        <span className="end-card__name">{copy.name}</span>
        <span className="end-card__latin">{copy.latin}</span>
      </div>
      <p className="end-card__tagline">{copy.tagline}</p>
      <ul className="end-card__facts">
        {copy.facts.map((fact) => <li key={fact}>{fact}</li>)}
      </ul>
      <p className="end-card__url">{copy.url}</p>
    </div>
  );
}
