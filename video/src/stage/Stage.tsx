import { useEffect, useState, type CSSProperties } from "react";
import { Caption } from "./Caption";
import { Clutter, type ClutterWindow } from "./Clutter";
import { Cursor } from "./Cursor";
import { EndCard, type EndCardCopy } from "./EndCard";
import { Wallpaper } from "./Wallpaper";
import { ISLAND_FRAME_WIDTH, STAGE_HEIGHT, STAGE_WIDTH, stage } from "./stageState";
import { useStore } from "./store";
import "./stage.css";

type StageProps = {
  lang: string;
  windows: ClutterWindow[];
  endCard: EndCardCopy;
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

export function Stage({ lang, windows, endCard }: StageProps) {
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
      <div className="stage-root" style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${fit})` }}>
        <div className="camera" style={cameraStyle}>
          <Wallpaper />
          <div className="dim" style={{ opacity: state.dim }} />
          <Clutter windows={windows} phase={state.clutter} />
          <iframe
            id="island-frame"
            className={`island-frame${state.islandVisible ? " island-frame--in" : ""}`}
            title="island"
            src={`/app.html?lang=${lang}`}
            width={ISLAND_FRAME_WIDTH}
            height={STAGE_HEIGHT}
          />
          <Cursor cursor={state.cursor} />
        </div>
        <Caption caption={state.caption} />
        <EndCard copy={endCard} visible={state.endCard} />
      </div>
    </div>
  );
}
