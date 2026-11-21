import { useEffect } from "react";
import { HIDE_TOOLTIP_EVENT } from "../../components/IconButtonTooltip";
import * as islandApi from "./api";

export function useHideHints() {
  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void islandApi.listenIslandHideHints(() => {
      window.dispatchEvent(new Event(HIDE_TOOLTIP_EVENT));
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => {
        console.error("Failed to listen for island hint hiding", error);
      });

    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);
}
