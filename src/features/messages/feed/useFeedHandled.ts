import { useCallback, useState } from "react";
import { loadHandled, saveHandled, withHandled } from "./storage";

export function useFeedHandled() {
  const [handled, setHandled] = useState<string[]>(loadHandled);
  const mark = useCallback((keys: readonly string[], present: ReadonlySet<string>) => {
    setHandled((previous) => {
      const next = withHandled(previous, keys, present);
      saveHandled(next);
      return next;
    });
  }, []);
  return { handled, mark };
}
