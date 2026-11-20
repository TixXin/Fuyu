import { useEffect, useState } from "react";
import { getPinImage, getPinInfo, listenPinAssigned, type PinInfo } from "../../features/screenshot/api";
import { getErrorMessage } from "../../utils/error";

export function usePinPicture() {
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void listenPinAssigned((event) => setInfo(event.payload)).then((unlisten) => {
      if (cancelled) unlisten();
      else stop = unlisten;
    });
    getPinInfo()
      .then((current) => { if (!cancelled && current) setInfo(current); })
      .catch((error: unknown) => console.error("Failed to read the pin", getErrorMessage(error)));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (!info) return;
    let cancelled = false;
    let made: string | null = null;
    getPinImage()
      .then(async (png) => {
        const url = URL.createObjectURL(new Blob([png], { type: "image/png" }));
        const image = new Image();
        image.src = url;
        await image.decode();
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        made = url;
        setUrl(url);
      })
      .catch((error: unknown) => console.error("Failed to show the pin", getErrorMessage(error)));
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [info]);

  return { info, url };
}
