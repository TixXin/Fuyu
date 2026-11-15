import { useEffect, useState } from "react";
import { listenFullscreen, readFullscreen } from "./api";
import { useIslandReminders, type IslandReminder } from "./reminders";

export type ShownReminder = { current: IslandReminder; more: number };

export function useIslandReminder(): ShownReminder | null {
  const queue = useIslandReminders();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    readFullscreen().then((value) => {
      if (active) setFullscreen(value);
    }).catch(() => undefined);
    const unlisten = listenFullscreen((value) => {
      if (active) setFullscreen(value);
    });
    return () => {
      active = false;
      void unlisten.then((stop) => stop()).catch(() => undefined);
    };
  }, []);

  const current = queue[0];
  return current && !fullscreen ? { current, more: queue.length - 1 } : null;
}
