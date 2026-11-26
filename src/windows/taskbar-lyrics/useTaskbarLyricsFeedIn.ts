import { useEffect, useState } from "react";
import { askIsland, listenTaskbarLyricsFeed, type TaskbarLyricsFeed } from "../../features/media/taskbar/api";

export function useTaskbarLyricsFeedIn(): TaskbarLyricsFeed | null {
  const [feed, setFeed] = useState<TaskbarLyricsFeed | null>(null);

  useEffect(() => {
    let didCancel = false;
    let unlisten: (() => void) | null = null;
    void listenTaskbarLyricsFeed(setFeed)
      .then((nextUnlisten) => {
        if (didCancel) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
        return askIsland("sync");
      })
      .catch((error) => console.error("Failed to follow the island's music", error));
    return () => {
      didCancel = true;
      unlisten?.();
    };
  }, []);

  return feed;
}
