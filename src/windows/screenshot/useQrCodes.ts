import { useEffect, useState } from "react";
import { readScreenshotQr, type ScreenshotQrCode } from "../../features/screenshot/api";
import { sameSelection } from "../../features/screenshot/qrText";
import type { PixelRect } from "../../features/screenshot/selection";

const SETTLE_MS = 250;

export function useQrCodes(selection: PixelRect | null, active: boolean): ScreenshotQrCode[] {
  const [found, setFound] = useState<{ rect: PixelRect; codes: ScreenshotQrCode[] } | null>(null);

  useEffect(() => {
    if (!selection || !active) return;
    let live = true;
    const timer = setTimeout(() => {
      readScreenshotQr(selection)
        .then((codes) => {
          if (live) setFound({ rect: selection, codes: Array.isArray(codes) ? codes : [] });
        })
        .catch(() => {});
    }, SETTLE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [selection, active]);

  return found && active && sameSelection(found.rect, selection) ? found.codes : [];
}
