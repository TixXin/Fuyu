import { useEffect, useState } from "react";

export function useDevicePixelRatio() {
  const [ratio, setRatio] = useState(() => window.devicePixelRatio);
  useEffect(() => {
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`);
    const update = () => setRatio(window.devicePixelRatio);
    query.addEventListener("change", update);
    if (window.devicePixelRatio !== ratio) update();
    return () => query.removeEventListener("change", update);
  }, [ratio]);
  return ratio;
}
