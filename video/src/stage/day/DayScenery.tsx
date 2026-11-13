import type { CSSProperties } from "react";
import { stage } from "../stageState";
import { useStore } from "../store";
import "./day.css";

export type DayScene = {
  id: string;
  time: string;
  label: string;
  hour: number;
  sky: [top: string, bottom: string];
  ink: "dark" | "light";
  sun: { x: number; y: number; color: string; size?: number };
};

export type DaySpec = {
  title: string;
  subtitle: string;
  scenes: DayScene[];
};

const FIRST_HOUR = 7;
const LAST_HOUR = 22;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, index) => FIRST_HOUR + index);

export function DayScenery({ title, subtitle, scenes }: DaySpec) {
  const { scene } = useStore(stage);
  const active = scenes.find((item) => item.id === scene) ?? scenes[0];
  const isTitle = active === scenes[0];
  const progress = (active.hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR);
  return (
    <div className={`day day--${active.ink}${isTitle ? " day--title" : ""}`}>
      {scenes.map((item) => (
        <div
          key={item.id}
          className="day__sky"
          style={{ opacity: item === active ? 1 : 0, backgroundImage: `linear-gradient(${item.sky[0]}, ${item.sky[1]})` }}
        />
      ))}
      <div
        className="day__sun"
        style={{
          left: `${active.sun.x}%`, top: `${active.sun.y}%`,
          "--sun": active.sun.color, "--sun-size": `${active.sun.size ?? 190}px`,
        } as CSSProperties}
      />
      <svg className="day__grain" aria-hidden="true">
        <filter id="day-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#day-grain)" />
      </svg>
      <div className="day__headline">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="day__clock">
        <span key={`label-${active.id}`} className="day__label">{active.label}</span>
        <span key={`time-${active.id}`} className="day__time">
          {[...active.time].map((char, index) => (
            <b key={index} style={{ "--order": index } as CSSProperties} className={char === ":" ? "is-colon" : undefined}>{char}</b>
          ))}
        </span>
      </div>
      <div className="day__rail">
        {HOURS.map((hour) => (
          <i key={hour} className={hour % 3 === 0 ? "is-major" : undefined} style={{ left: `${((hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR)) * 100}%` }}>
            {hour % 3 === 0 && <em>{String(hour).padStart(2, "0")}</em>}
          </i>
        ))}
        <span className="day__marker" style={{ left: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
