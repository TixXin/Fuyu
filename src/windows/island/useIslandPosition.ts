import { useCallback, useEffect, useRef, useState } from "react";
import * as islandApi from "./api";
import { clearIslandPosition, loadIslandPosition, saveIslandPosition, type IslandPosition } from "./storage";
import { useModifierWindowDrag } from "./useModifierWindowDrag";
import { useIslandHoldListener } from "./islandHold";

export function useIslandPosition() {
  const [isPositionDetached, setIsPositionDetached] = useState(() => loadIslandPosition() !== null);
  const islandPositionRef = useRef<IslandPosition | null>(loadIslandPosition());

  const startIslandDrag = useCallback(() => {
    setIsPositionDetached(true);
    void islandApi.startIslandDrag().catch((error) => {
      setIsPositionDetached(isPositionDetached);
      console.error("Failed to start island drag", error);
    });
  }, [isPositionDetached]);

  const startIslandModifierDrag = useCallback(() => {
    void islandApi.startIslandModifierDrag().catch((error) => {
      console.error("Failed to start island modifier drag", error);
    });
  }, []);
  useModifierWindowDrag(startIslandModifierDrag);
  useIslandHoldListener();

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void islandApi.listenIslandPositionChanged(({ payload }) => {
      islandPositionRef.current = payload;
      setIsPositionDetached(true);
      saveIslandPosition(payload);
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => {
        console.error("Failed to listen for island position changes", error);
      });

    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void islandApi.listenIslandPositionCleared(() => {
      islandPositionRef.current = null;
      setIsPositionDetached(false);
      clearIslandPosition();
    })
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
        } else {
          unlisten = nextUnlisten;
        }
      })
      .catch((error) => {
        console.error("Failed to listen for the island's position being cleared", error);
      });

    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return { isPositionDetached, setIsPositionDetached, islandPositionRef, startIslandDrag };
}
