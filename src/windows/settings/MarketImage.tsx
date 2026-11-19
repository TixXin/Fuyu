import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { isMarketImage, useMarketImage } from "./marketImages";

const NEAR = "240px";

export function MarketImage({ url, lazy = false, ...img }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> & { url: string; lazy?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const waits = lazy && isMarketImage(url) && typeof IntersectionObserver === "function";
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!waits || seen || !node) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setSeen(true), { rootMargin: NEAR });
    observer.observe(node);
    return () => observer.disconnect();
  }, [waits, seen]);
  const src = useMarketImage(url, !waits || seen);
  return <img ref={ref} {...img} loading={lazy ? "lazy" : undefined} src={src ?? undefined} />;
}
