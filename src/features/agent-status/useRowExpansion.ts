import { useCallback, useState } from "react";

type Flipped = { expand: boolean; keys: ReadonlySet<string> };

const NONE: ReadonlySet<string> = new Set();

export function useRowExpansion(expand: boolean) {
  const [flipped, setFlipped] = useState<Flipped>(() => ({ expand, keys: NONE }));
  if (flipped.expand !== expand) setFlipped({ expand, keys: NONE });
  const keys = flipped.expand === expand ? flipped.keys : NONE;
  const isOpen = (key: string) => expand !== keys.has(key);
  const toggle = (key: string) =>
    setFlipped((current) => {
      const next = new Set(current.keys);
      if (!next.delete(key)) next.add(key);
      return { expand: current.expand, keys: next };
    });
  const keep = useCallback(
    (alive: ReadonlySet<string>) =>
      setFlipped((current) => {
        const kept = [...current.keys].filter((key) => alive.has(key));
        return kept.length === current.keys.size ? current : { expand: current.expand, keys: new Set(kept) };
      }),
    [],
  );
  return { isOpen, toggle, keep };
}
