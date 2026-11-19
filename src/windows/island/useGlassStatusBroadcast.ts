import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { emitIslandGlassStatus, listenIslandGlassStatusRequest } from "./api";
import { sameGlassStatus, type IslandGlassStatus } from "./glassStatus";

export function useGlassStatusBroadcast(status: IslandGlassStatus) {
  const current = useRef(status);
  const sent = useRef<IslandGlassStatus | null>(null);

  useEffect(() => {
    current.current = status;
    if (!isTauri() || sameGlassStatus(sent.current, status)) return;
    sent.current = status;
    void emitIslandGlassStatus(status).catch(() => {});
  }, [status]);

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    const stop = listenIslandGlassStatusRequest(() => {
      if (!alive) return;
      sent.current = current.current;
      void emitIslandGlassStatus(current.current).catch(() => {});
    });
    return () => {
      alive = false;
      void stop.then((unlisten) => unlisten(), () => {});
    };
  }, []);
}
