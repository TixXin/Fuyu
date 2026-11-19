import { GitMerge, GitPullRequest, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Cursor } from "../../stage/Cursor";
import { FORMAT } from "../../stage/stageState";
import { Cover } from "./cover";
import { useStore } from "../../stage/store";
import type { Lang } from "../types";
import { copyFor, type Copy } from "./copy";
import { LOOK, scene, type Scene } from "./state";

const RAMP = ".,-~:;=!*#$@";

function Decode({ text }: { text: string }) {
  const [tick, setTick] = useState(0);
  const chars = [...text];
  useEffect(() => {
    if (tick > chars.length + 8) return;
    const timer = window.setTimeout(() => setTick((value) => value + 1), 34);
    return () => window.clearTimeout(timer);
  }, [tick, chars.length]);
  return (
    <>
      {chars.map((char, index) => {
        const settled = index < tick - 6;
        const shown = settled || char === "\n" || char === " " ? char : tick < index ? "" : RAMP[(index * 7 + tick * 3) % RAMP.length];
        return char === "\n" ? <br key={index} /> : <span key={index} className={settled ? undefined : "decode__noise"}>{shown}</span>;
      })}
    </>
  );
}

function Lines({ text }: { text: string }) {
  return <>{text.split("\n").map((line, index) => <span key={index} className="card__line" style={{ animationDelay: `${120 + index * 110}ms` }}>{line}</span>)}</>;
}

function TitleCard({ card }: { card: NonNullable<Scene["card"]> }) {
  return (
    <div key={card.id} className={`card card--${LOOK}${card.full ? " card--full" : ""}`}>
      {LOOK === "glass" && <div className="card__blobs"><i /><i /><i /><i /></div>}
      {LOOK === "swiss" && <div className="card__grid" />}
      <div className="card__panel">
        <p className="card__kicker">
          <b>{LOOK === "ascii" ? `[${card.index}]` : card.index}</b>
          <span>{card.kicker}</span>
        </p>
        <h2 className="card__text">{LOOK === "ascii" ? <Decode text={card.text} /> : <Lines text={card.text} />}</h2>
      </div>
    </div>
  );
}

function Phone({ copy, state }: { copy: Copy; state: Scene }) {
  return (
    <div className={`phone phone--${state.phone}`}>
      <div className="phone__screen">
        <div className="phone__status"><b>10:31</b><span>5G</span></div>
        <div className="phone__push">
          <span className="phone__app"><Send size={14} /></span>
          <div>
            <b>{copy.phone.bot}</b>
            <strong>{copy.phone.push.title}</strong>
            <p>{copy.phone.push.body}</p>
          </div>
        </div>
        <div className="phone__chat">
          <header><span className="phone__app"><Send size={13} /></span><b>{copy.phone.bot}</b><em>{copy.phone.via}</em></header>
          <div className="phone__bubbles">
            <p className="bubble bubble--bot"><b>{copy.phone.push.title}</b>{copy.phone.push.body}</p>
            {state.chat.map((line, index) => <p key={index} className={`bubble bubble--${line.from}`}>{line.text}</p>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function PrCard({ copy, state }: { copy: Copy; state: Scene }) {
  const { pr } = copy.plugin;
  const merged = state.pr === "merged";
  return (
    <div className={`pr pr--${state.pr}`}>
      <p className="pr__repo">{pr.repo}</p>
      <h3>{pr.title}</h3>
      <p className="pr__meta">
        <span className={`pr__state${merged ? " pr__state--merged" : ""}`}>
          {merged ? <GitMerge size={14} /> : <GitPullRequest size={14} />}
          {merged ? pr.state : "Open"}
        </span>
        <i className="pr__avatar" />
        <b>{pr.author}</b>
      </p>
    </div>
  );
}

export const SETTINGS_FRAME = FORMAT === "vertical"
  ? { left: 22, top: 110, width: 1040, height: 1060, scale: 0.65 }
  : { left: 170, top: 30, width: 1040, height: 600, scale: 0.9 };

function SettingsWindow({ lang, state }: { lang: Lang; state: Scene }) {
  if (state.settings === "hidden") return null;
  const { left, top, width, height, scale } = SETTINGS_FRAME;
  return (
    <div className={`settings-win settings-win--${state.settings}`} style={{ left, top, width, height, transform: `scale(${scale})` }}>
      <iframe id="settings-frame" title="settings" src={`/app.html?window=settings&lang=${lang}`} width={width} height={height} />
    </div>
  );
}

function Overlay({ lang }: { lang: Lang }) {
  const state = useStore(scene);
  const copy = copyFor(lang);
  return (
    <div className="at-work-overlay">
      <Phone copy={copy} state={state} />
      <PrCard copy={copy} state={state} />
      <div className="at-work-zoom" style={{ transformOrigin: `${state.zoom.x}px ${state.zoom.y}px`, transform: `scale(${state.zoom.scale})` }}>
        <SettingsWindow lang={lang} state={state} />
        <Cursor cursor={state.cursor} />
      </div>
      {state.card && <TitleCard card={state.card} />}
      <Cover copy={copy} lang={lang} state={state.cover} />
    </div>
  );
}

export function overlay(lang: Lang) {
  return <Overlay lang={lang} />;
}
