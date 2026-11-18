import "./cover.css";
import type { Lang } from "../types";
import bar from "./cover/bar.png";
import barEn from "./cover/en/bar.png";
import listEn from "./cover/en/list.png";
import lyricsEn from "./cover/en/lyrics.png";
import list from "./cover/list.png";
import lyrics from "./cover/lyrics.png";
import type { Copy } from "./copy";
import type { Scene } from "./state";

const TAGS: [string, string, number][] = [
  ["Claude Code", "#d97757", -4], ["Codex", "#111", 3], ["Kimi Code", "#1f1f1f", -2],
  ["Qwen Code", "#615ced", 2], ["opencode", "#333", -3], ["Copilot CLI", "#24292f", 4],
];

const SHOTS = { zh: { bar, list, lyrics }, en: { bar: barEn, list: listEn, lyrics: lyricsEn } };

export function Cover({ copy, lang, state }: { copy: Copy; lang: Lang; state: Scene["cover"] }) {
  if (state === "hidden") return null;
  const shots = SHOTS[lang];
  return (
    <div className={`cover cover--${state} cover--${lang}`}>
      <div className="cover__board">
        <div className="cover__card cover__list"><img src={shots.list} alt="" /></div>
        <div className="cover__card cover__bar"><img src={shots.bar} alt="" /></div>
        <div className="cover__card cover__lyrics"><img src={shots.lyrics} alt="" /></div>
        <h1 className="cover__title">{copy.cover.title.map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="cover__sub">{copy.cover.sub}</p>
        <div className="cover__tags">
          {TAGS.map(([name, color, tilt]) => (
            <span key={name} style={{ background: color, rotate: `${tilt}deg` }}>{name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
