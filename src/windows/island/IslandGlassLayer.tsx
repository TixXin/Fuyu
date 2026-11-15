import { useCallback, useState } from "react";
import { IslandGlassShader } from "./IslandGlassShader";
import type { IslandGlassView } from "./useIslandGlass";
import "./IslandGlass.css";
import "./IslandGlassFlow.css";
import "./IslandGlassLight.css";

export function IslandGlassLayer({ glass }: { glass?: IslandGlassView }) {
  const [shaderFailed, setShaderFailed] = useState(false);
  const shader = glass?.shader === true && !shaderFailed;
  const fail = useCallback(() => setShaderFailed(true), []);

  return (
    <div className="island__glass" aria-hidden="true">
      <span className="island__glass-backdrop" />
      {glass && !shader && (
        <span className="island__glass-flow">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      {glass && shader && (
        <IslandGlassShader palette={glass.palette} paused={glass.paused} strength={glass.strength} onFail={fail} />
      )}
      <span className="island__glass-sheen" />
      <span className="island__glass-refraction" />
      <span className="island__glass-highlight" />
      <span className="island__glass-rim" />
    </div>
  );
}
