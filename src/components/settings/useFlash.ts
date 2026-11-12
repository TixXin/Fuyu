import { useCallback, useEffect, useRef, useState } from "react";

const FLASH_MS = 4000;

export function useFlash<T>() {
  const [value, setValue] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const flash = useCallback((next: T | null) => {
    window.clearTimeout(timer.current);
    setValue(next);
    if (next !== null) timer.current = window.setTimeout(() => setValue(null), FLASH_MS);
  }, []);

  return [value, flash] as const;
}
