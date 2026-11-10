import { useEffect, useState } from "react";

/**
 * `window.devicePixelRatio`, updated when it changes: the window moved to a screen with another
 * scale, or the scale of its screen changed. A `resolution` query matches only the current ratio,
 * so it fires once on a change and is then replaced by one for the new ratio.
 */
export function useDevicePixelRatio() {
  const [ratio, setRatio] = useState(() => window.devicePixelRatio);
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`);
    const update = () => setRatio(window.devicePixelRatio);
    query.addEventListener("change", update);
    // The ratio may have changed between the render and this effect.
    if (window.devicePixelRatio !== ratio) update();
    return () => query.removeEventListener("change", update);
  }, [ratio]);
  return ratio;
}
