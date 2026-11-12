import { useEffect, useRef } from "react";
import * as islandApi from "./api";
import "./ModifierWindowDrag.css";

const MOVE_ARMED_CLASS = "island-move-armed";
const DRAG_KIND_ATTRIBUTE = "islandDrag";

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
    let swallowNextClick = false;

    const press = (event: PointerEvent) => {
      swallowNextClick = false;
      if (event.button !== 0 || !(isArmedRef.current || event.altKey)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      swallowNextClick = true;
      onDragStartRef.current();
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
