import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Caption } from "./Caption";
import { Clutter, type ClutterWindow } from "./Clutter";
import { Cursor } from "./Cursor";
import { EndCard, type EndCardCopy } from "./EndCard";
import { Wallpaper } from "./Wallpaper";
import { FORMAT, ISLAND_FRAME_WIDTH, SCREEN_HEIGHT, SCREEN_TOP, STAGE_HEIGHT, STAGE_WIDTH, stage } from "./stageState";
import { useStore } from "./store";
import "./stage.css";

type StageProps = {
  lang: string;
  windows: ClutterWindow[];
  endCard: EndCardCopy;
  backdrop?: ReactNode;
  scenery?: ReactNode;
  look: "promo" | "recording" | "editorial";
};

function useFit() {
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const update = () => setFit(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return fit;
}

export function Stage({ lang, windows, endCard, backdrop, scenery, look }: StageProps) {
  const state = useStore(stage);
  const fit = useFit();
  const { camera } = state;
  const cameraStyle = {
    transform: `scale(${camera.scale})`,
    transformOrigin: `${camera.x}px ${camera.y}px`,
    transitionDuration: `${camera.ms}ms`,
  } as CSSProperties;

  return (
    <div className="viewport" style={{ width: STAGE_WIDTH * fit, height: STAGE_HEIGHT * fit }}>
      <div className={`stage-root stage-root--${FORMAT} stage-root--${look} stage-root--ink-${state.ink}`} style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${fit})` }}>
        {state.title && <h1 key={state.title} className="stage-title">{state.title}</h1>}
        <div className="screen" style={{ top: SCREEN_TOP, height: SCREEN_HEIGHT }}>
          {scenery}
          <div className="camera" style={cameraStyle}>
            {backdrop ?? (scenery ? null : <Wallpaper />)}
            <div className="dim" style={{ opacity: state.dim }} />
            {!backdrop && !scenery && <Clutter windows={windows} phase={state.clutter} />}
            <iframe
              id="island-frame"
              className={`island-frame${state.islandVisible ? " island-frame--in" : ""}`}
              style={{ left: (STAGE_WIDTH - ISLAND_FRAME_WIDTH) / 2 }}
              title="island"
              src={`/app.html?lang=${lang}&format=${FORMAT}`}
              width={ISLAND_FRAME_WIDTH}
              height={SCREEN_HEIGHT}
            />
            <Cursor cursor={state.cursor} />
          </div>
          <Caption caption={state.caption} />
        </div>
        <EndCard copy={endCard} visible={state.endCard} />
      </div>
    </div>
  );
}
