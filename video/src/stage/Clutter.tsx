import type { CSSProperties } from "react";
import type { StageState } from "./stageState";

export type ClutterWindow = {
  id: string;
  title: string;
  badge?: string;
  kind: "chat" | "mail" | "music" | "terminal" | "notes" | "translate" | "clipboard";
  x: number;
  y: number;
  width: number;
  height: number;
  tilt: number;
  lines: string[];
};

function Body({ window: item }: { window: ClutterWindow }) {
  if (item.kind === "music") {
    return (
      <div className="clutter__music">
        <i className="clutter__cover" />
        <div>
          <strong>{item.lines[0]}</strong>
          <span>{item.lines[1]}</span>
          <em><b /></em>
        </div>
      </div>
    );
  }
  if (item.kind === "terminal") {
    return <pre className="clutter__terminal">{item.lines.join("\n")}</pre>;
  }
  if (item.kind === "notes") {
    return (
      <ul className="clutter__notes">
        {item.lines.map((line) => <li key={line}><i />{line}</li>)}
      </ul>
    );
  }
  return (
    <ul className={`clutter__rows clutter__rows--${item.kind}`}>
      {item.lines.map((line, index) => (
        <li key={line}><i style={{ "--hue": 200 + index * 47 } as CSSProperties} /><span>{line}</span></li>
      ))}
    </ul>
  );
}

export function Clutter({ windows, phase }: { windows: ClutterWindow[]; phase: StageState["clutter"] }) {
  return (
    <div className={`clutter clutter--${phase}`}>
      {windows.map((item, index) => (
        <section
          key={item.id}
          className={`clutter__window clutter__window--${item.kind}`}
          style={{
            left: item.x, top: item.y, width: item.width, height: item.height,
            "--tilt": `${item.tilt}deg`, "--order": index,
            "--to-x": `${640 - (item.x + item.width / 2)}px`, "--to-y": `${18 - (item.y + item.height / 2)}px`,
          } as CSSProperties}
        >
          <header>
            <span className="clutter__dot" />
            <b>{item.title}</b>
            {item.badge && <mark>{item.badge}</mark>}
            <span className="clutter__controls"><i /><i /><i /></span>
          </header>
          <Body window={item} />
        </section>
      ))}
    </div>
  );
}
