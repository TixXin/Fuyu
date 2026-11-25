import { useEffect, useRef, useState } from "react";
import { listenFileDrop, setIslandFileDropAccepted } from "../api";
import { shouldAcceptFileDrop } from "../fileShelf.ts";
import type { FileShelfController } from "../useFileShelf";

type FileShelfDropOptions<Page extends string> = {
  enabled: boolean;
  expandOnDrop: boolean;
  mode: string;
  page: Page;
  isTucked: boolean;
  isPeeking: boolean;
  shelf: Pick<FileShelfController, "addPaths" | "isDraggingOut">;
  openIslandPage: (page: "shelf") => void;
  setPage: (page: Page) => void;
  collapseIsland: () => void;
  tuckIsland: () => void;
  minimizeToEdge: () => void;
};

export function useFileShelfDrop<Page extends string>(options: FileShelfDropOptions<Page>) {
  const [isDropping, setIsDropping] = useState(false);
  const latestRef = useRef(options);
  const restoreRef = useRef<(() => void) | null>(null);
  const ignoringRef = useRef(false);

  const acceptsDrop = shouldAcceptFileDrop(options.enabled, options.expandOnDrop, options.mode, options.page);

  useEffect(() => {
    void setIslandFileDropAccepted(acceptsDrop).catch((error) => {
      console.error("Failed to sync island file drop state", error);
    });
  }, [acceptsDrop]);

  useEffect(() => () => {
    void setIslandFileDropAccepted(false).catch(() => undefined);
  }, []);

  useEffect(() => {
    latestRef.current = options;
  });

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;

    void listenFileDrop((event) => {
      const current = latestRef.current;
      if (!current.enabled || current.shelf.isDraggingOut()) return;

      if (event.type === "enter") {
        const isShelfOpen = current.mode === "expanded" && current.page === "shelf";
        ignoringRef.current = !isShelfOpen && !current.expandOnDrop;
        if (ignoringRef.current) return;
        setIsDropping(true);
        if (isShelfOpen) return;
        const previousPage = current.page;
        restoreRef.current = current.isTucked
          ? current.tuckIsland
          : current.isPeeking
            ? current.minimizeToEdge
            : current.mode === "collapsed"
              ? current.collapseIsland
              : () => latestRef.current.setPage(previousPage);
        current.openIslandPage("shelf");
      } else if (ignoringRef.current) {
        ignoringRef.current = false;
      } else if (event.type === "drop") {
        setIsDropping(false);
        restoreRef.current = null;
        void current.shelf.addPaths(event.paths);
      } else {
        setIsDropping(false);
        const restore = restoreRef.current;
        restoreRef.current = null;
        restore?.();
      }
    })
      .then((nextUnlisten) => {
        if (didCancel) nextUnlisten();
        else unlisten = nextUnlisten;
      })
      .catch((error) => {
        console.error("Failed to listen for dropped files", error);
      });

    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return isDropping;
}
