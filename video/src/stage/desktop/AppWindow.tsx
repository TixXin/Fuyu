import { Copy, Minus, X } from "lucide-react";
import type { CSSProperties } from "react";

export type CodeLine = { indent?: number; parts: [tone: "plain" | "key" | "name" | "text" | "note" | "num", text: string][] };

export type DesktopWindow = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
} & (
  | { kind: "editor"; files: string[]; tabs: string[]; code: CodeLine[]; status: string }
  | { kind: "browser"; tabs: string[]; url: string; heading: string; paragraphs: string[]; nav: string[] }
);

function Editor({ window: item }: { window: Extract<DesktopWindow, { kind: "editor" }> }) {
  return (
    <div className="app-editor">
      <aside className="app-editor__files">
        {item.files.map((file, index) => <span key={file} className={index === 1 ? "is-open" : undefined}>{file}</span>)}
      </aside>
      <div className="app-editor__main">
        <div className="app-editor__tabs">
          {item.tabs.map((tab, index) => <span key={tab} className={index === 0 ? "is-open" : undefined}>{tab}</span>)}
        </div>
        <pre className="app-editor__code">
          {item.code.map((line, index) => (
            <div key={index}>
              <i>{index + 1}</i>
              <span style={{ paddingLeft: (line.indent ?? 0) * 16 }}>
                {line.parts.map(([tone, text], part) => <b key={part} className={`tone-${tone}`}>{text}</b>)}
              </span>
            </div>
          ))}
        </pre>
        <div className="app-editor__status">{item.status}</div>
      </div>
    </div>
  );
}

function Browser({ window: item }: { window: Extract<DesktopWindow, { kind: "browser" }> }) {
  return (
    <div className="app-browser">
      <div className="app-browser__bar"><span className="app-browser__url">{item.url}</span></div>
      <div className="app-browser__page">
        <nav>{item.nav.map((entry, index) => <span key={entry} className={index === 1 ? "is-open" : undefined}>{entry}</span>)}</nav>
        <article>
          <h2>{item.heading}</h2>
          {item.paragraphs.map((text) => <p key={text}>{text}</p>)}
          <div className="app-browser__figure" />
        </article>
      </div>
    </div>
  );
}

export function AppWindow({ window: item, style }: { window: DesktopWindow; style?: CSSProperties }) {
  return (
    <section
      className={`app-window app-window--${item.kind}`}
      style={{ ...style, left: item.x, top: item.y, width: item.width, height: item.height }}
    >
      <header className="app-window__title">
        {item.kind === "browser"
          ? <div className="app-window__tabs">{item.tabs.map((tab, index) => <span key={tab} className={index === 0 ? "is-open" : undefined}>{tab}</span>)}</div>
          : <span className="app-window__name">{item.title}</span>}
        <span className="app-window__caption">
          <i><Minus size={12} strokeWidth={1.2} /></i>
          <i><Copy size={10} strokeWidth={1.2} /></i>
          <i><X size={13} strokeWidth={1.2} /></i>
        </span>
      </header>
      {item.kind === "editor" ? <Editor window={item} /> : <Browser window={item} />}
    </section>
  );
}
