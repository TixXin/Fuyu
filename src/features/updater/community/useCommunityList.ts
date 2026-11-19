import { useCallback, useEffect, useState } from "react";
import { loadCommunityList, type CommunityList } from "./communityGroups.ts";

export type CommunityState = { status: "loading" } | { status: "failed" } | { status: "ready"; list: CommunityList };

export function useCommunityList() {
  const [state, setState] = useState<CommunityState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    void loadCommunityList((url, init) => fetch(url, init)).then((list) => {
      if (alive) setState(list ? { status: "ready", list } : { status: "failed" });
    });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}
