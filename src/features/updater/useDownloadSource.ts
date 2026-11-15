import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getNativeUpdateState, listenUpdateState, type UpdateSnapshot } from "./api";

export function useDownloadSource() {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let current = true;
    let revision = -1;
    const take = (state: UpdateSnapshot) => {
      if (!current || state.revision < revision) return;
      revision = state.revision;
      setSource(state.downloadSource ?? null);
    };
    const unlisten = listenUpdateState(take);
    void getNativeUpdateState().then(take).catch(() => {});
    return () => {
      current = false;
      void unlisten.then((stop) => stop()).catch(() => {});
    };
  }, []);

  return source;
}
