import { useEffect, useState } from "react";
import { readPlatformSupport, type PlatformFeature } from "./api.ts";

export type { PlatformFeature, PlatformSupport } from "./api.ts";

export const isMacOS = typeof navigator !== "undefined" && /Macintosh|Mac OS X/.test(navigator.userAgent);

const NONE: ReadonlySet<PlatformFeature> = new Set();
let pending: Promise<ReadonlySet<PlatformFeature>> | null = null;

export function loadUnsupportedFeatures(): Promise<ReadonlySet<PlatformFeature>> {
  pending ??= readPlatformSupport()
    .then((support) => new Set(support.unsupported))
    .catch(() => NONE);
  return pending;
}

export function useUnsupportedFeatures(): ReadonlySet<PlatformFeature> {
  const [unsupported, setUnsupported] = useState(NONE);
  useEffect(() => {
    let live = true;
    void loadUnsupportedFeatures().then((features) => {
      if (live) setUnsupported(features);
    });
    return () => {
      live = false;
    };
  }, []);
  return unsupported;
}
