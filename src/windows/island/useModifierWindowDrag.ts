import { useEffect, useRef } from "react";
import { HIDE_TOOLTIP_EVENT } from "../../components/IconButtonTooltip";
import { isMacOS } from "../../lib/platform";
import * as islandApi from "./api";
import "./ModifierWindowDrag.css";

const MOVE_ARMED_CLASS = "island-move-armed";
const DRAG_KIND_ATTRIBUTE = "islandDrag";

function isDragModifierDown(event: PointerEvent) {
  return isMacOS ? event.ctrlKey : event.altKey;
}

function isDragButton(event: PointerEvent) {
  return event.button === 0 || (isMacOS && event.button === 2 && event.ctrlKey);
}

export function useModifierWindowDrag(onDragStart: () => void) {
  const isArmedRef = useRef(false);
  const onDragStartRef = useRef(onDragStart);

  useEffect(() => {
    onDragStartRef.current = onDragStart;
  }, [onDragStart]);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void islandApi.listenIslandMoveArmed((target) => {
      const armed = target !== "none";
      isArmedRef.current = armed;
      document.documentElement.classList.toggle(MOVE_ARMED_CLASS, armed);
      document.documentElement.dataset[DRAG_KIND_ATTRIBUTE] = target;
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => {
        console.error("Failed to listen for island move modifier", error);
      });

    return () => {
      didCancel = true;
      unlisten?.();
      document.documentElement.classList.remove(MOVE_ARMED_CLASS);
      delete document.documentElement.dataset[DRAG_KIND_ATTRIBUTE];
    };
  }, []);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void islandApi.listenIslandHideHints(() => {
      isArmedRef.current = false;
      document.documentElement.classList.remove(MOVE_ARMED_CLASS);
      document.documentElement.dataset[DRAG_KIND_ATTRIBUTE] = "none";
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
    let swallowNextContextMenu = false;

    const press = (event: PointerEvent) => {
      swallowNextClick = false;
      swallowNextContextMenu = false;
      if (!isDragButton(event) || !(isArmedRef.current || isDragModifierDown(event))) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      swallowNextClick = true;
      swallowNextContextMenu = isMacOS;
      onDragStartRef.current();
    };
    const contextMenu = (event: MouseEvent) => {
      if (swallowNextContextMenu) {
        swallowNextContextMenu = false;
        event.preventDefault();
        event.stopPropagation();
      }
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
    window.addEventListener("contextmenu", contextMenu, true);
    return () => {
      window.removeEventListener("pointerdown", press, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("contextmenu", contextMenu, true);
    };
  }, []);
}
