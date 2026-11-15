import "./IslandGlass.css";
import "./IslandGlassLight.css";

export function IslandGlassLayer() {
  return (
    <div className="island__glass" aria-hidden="true">
      <span className="island__glass-refraction" />
      <span className="island__glass-highlight" />
    </div>
  );
}
