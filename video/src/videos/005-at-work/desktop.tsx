import type { CSSProperties } from "react";
import claudeIcon from "../../../../src/assets/brands/claude-code.png";
import codexIcon from "../../../../src/assets/brands/codex.webp";
import copilotIcon from "../../../../src/assets/brands/copilot.png";
import kimiIcon from "../../../../src/assets/brands/kimi-code.png";
import opencodeIcon from "../../../../src/assets/brands/opencode.png";
import qwenIcon from "../../../../src/assets/brands/qwen.png";
import { Taskbar } from "../../stage/desktop/Taskbar";
import "../../stage/desktop/desktop.css";
import { FORMAT, SCREEN_HEIGHT, STAGE_WIDTH, stage } from "../../stage/stageState";
import { useStore } from "../../stage/store";
import wallpaper from "../003-messages/wallpaper.jpg";
import { scene } from "./state";
import "./at-work.css";

export const TERMINALS = [
  { id: "claudeCode", label: "Claude Code", icon: claudeIcon },
  { id: "codex", label: "Codex", icon: codexIcon },
  { id: "opencode", label: "opencode", icon: opencodeIcon },
  { id: "qwen", label: "Qwen Code", icon: qwenIcon },
  { id: "kimiCode", label: "Kimi Code", icon: kimiIcon },
  { id: "copilot", label: "Copilot CLI", icon: copilotIcon },
] as const;

const VERTICAL = FORMAT === "vertical";
const GAP = 14;
const TOP = 58;
const COLS = VERTICAL ? 2 : 3;
const ROWS = TERMINALS.length / COLS;
const WIDTH = (STAGE_WIDTH - GAP * (COLS + 1)) / COLS;
const HEIGHT = (SCREEN_HEIGHT - 44 - TOP - GAP * ROWS) / ROWS;
const FOCUS = VERTICAL ? { left: 20, top: 90, width: 680, height: 600 } : { left: 190, top: 70, width: 900, height: 520 };

function rect(index: number) {
  return { left: GAP + (index % COLS) * (WIDTH + GAP), top: TOP + Math.floor(index / COLS) * (HEIGHT + GAP), width: WIDTH, height: HEIGHT };
}

function Terminal({ index }: { index: number }) {
  const { terms, focus, ring } = useStore(scene);
  const item = TERMINALS[index];
  const lines = terms[item.id] ?? [];
  const focused = focus === item.id;
  const style = { ...(focused ? FOCUS : rect(index)), zIndex: focused ? 20 : index + 1 } as CSSProperties;
  return (
    <section className={`term${focused ? " term--focus" : ""}${focus && !focused ? " term--back" : ""}${ring === item.id ? " term--ring" : ""}`} style={style}>
      <header className="term__bar">
        <img src={item.icon} alt="" width={14} height={14} draggable={false} />
        <b>{item.label}</b>
        <span>~/fuyu</span>
      </header>
      <div className="term__body">
        {lines.map(([tone, text], line) => <p key={line} className={`term__line term__line--${tone}`}>{text}</p>)}
        <p className="term__line term__line--caret"><i /></p>
      </div>
    </section>
  );
}

const ISLAND = { x: STAGE_WIDTH / 2, y: 22 };

function Ghosts() {
  const { gather } = useStore(scene);
  if (!gather) return null;
  return (
    <>
      {TERMINALS.map((item, index) => {
        const box = rect(index);
        const style = {
          ...box,
          "--dx": `${ISLAND.x - (box.left + box.width / 2)}px`,
          "--dy": `${ISLAND.y - (box.top + box.height / 2)}px`,
          "--delay": `${index * 70}ms`,
        } as CSSProperties;
        return <div key={item.id} className="term-ghost" style={style}><img src={item.icon} alt="" draggable={false} /></div>;
      })}
    </>
  );
}

export function Desktop() {
  const { scene: phase } = useStore(stage);
  const { away } = useStore(scene);
  return (
    <div className={`desktop desktop--${phase || "idle"}${away ? " desktop--away" : ""}`}>
      <img className="desktop__wallpaper" src={wallpaper} alt="" draggable={false} />
      {TERMINALS.map((item, index) => <Terminal key={item.id} index={index} />)}
      <Ghosts />
      <Taskbar
        scene={phase}
        apps={[
          { id: "folder", icon: "folder" },
          { id: "browser", icon: "browser", running: true },
          { id: "terminal", icon: "editor", running: true, focused: true },
        ]}
      />
    </div>
  );
}
