import { useEffect, useRef } from "react";
import { HIDE_TOOLTIP_EVENT } from "../../components/IconButtonTooltip";
import * as islandApi from "./api";
import "./EdgeResize.css";

const RESIZE_ARMED_CLASS = "island-resize-armed";
const EDGE_ATTRIBUTE = "islandDrag";

function showEdge(target: islandApi.IslandResizeTarget) {
  document.documentElement.classList.toggle(RESIZE_ARMED_CLASS, target !== "none");
  document.documentElement.dataset[EDGE_ATTRIBUTE] = target;
}

export function useEdgeResize() {
  const isArmedRef = useRef(false);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void islandApi.listenIslandMoveArmed((target) => {
      isArmedRef.current = target !== "none";
      showEdge(target);
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => {
        console.error("Failed to listen for the island resize edge", error);
      });

    return () => {
      didCancel = true;
      unlisten?.();
      document.documentElement.classList.remove(RESIZE_ARMED_CLASS);
      delete document.documentElement.dataset[EDGE_ATTRIBUTE];
    };
  }, []);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void islandApi.listenIslandHideHints(() => {
      isArmedRef.current = false;
      showEdge("none");
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

  useEffect(() => {
    let swallowNextClick = false;

    const press = (event: PointerEvent) => {
      swallowNextClick = false;
      if (event.button !== 0 || !isArmedRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      swallowNextClick = true;
      void islandApi.startIslandEdgeResize().catch((error) => {
        console.error("Failed to start resizing the island", error);
      });
    };
    const click = (event: MouseEvent) => {
      if (swallowNextClick && event.detail > 0) {
        swallowNextClick = false;
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("pointerdown", press, true);
    window.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("click", click, true);
    };
  }, []);
}
