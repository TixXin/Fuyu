import { useEffect, useState } from "react";
import { getPetSpritesheet } from "./api";

export function usePetSheet(id: string | null, retryToken?: unknown): string | null | undefined {
  const [sheet, setSheet] = useState<{ id: string; src: string | null } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getPetSpritesheet(id, { retryFailed: true })
      .then((src) => !cancelled && setSheet({ id, src }))
      .catch(() => !cancelled && setSheet({ id, src: null }));
    return () => {
      cancelled = true;
    };
  }, [id, retryToken]);

  if (!id) return null;
  return sheet?.id === id ? sheet.src : undefined;
}
