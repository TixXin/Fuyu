import { useLayoutEffect, useRef, useState } from "react";

const MIN_SCALE = 0.1;
const STEP = 0.005;

export function useFitScale({ max = 1, pad = 0, height = true }: { max?: number; pad?: number; height?: boolean } = {}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(max);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return;
    const measure = () => {
      const wide = content.offsetWidth;
      const tall = content.offsetHeight;
      if (!wide || !tall || !box.clientWidth) return;
      const byHeight = height ? (box.clientHeight - pad) / tall : max;
      const next = Math.max(MIN_SCALE, Math.min(max, (box.clientWidth - pad) / wide, byHeight));
      setScale((current) => (Math.abs(current - next) < STEP ? current : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(content);
    return () => observer.disconnect();
  }, [max, pad, height]);

  return { boxRef, contentRef, scale };
}
