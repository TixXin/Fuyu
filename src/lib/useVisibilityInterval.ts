import { useEffect, useRef } from "react";

export function useVisibilityInterval(
  callback: () => void,
  delayMs: number | null,
): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delayMs === null) return;

    let id: number | undefined;

    function start() {
      if (id !== undefined) return;
      id = window.setInterval(() => savedCallback.current(), delayMs!);
    }

    function stop() {
      if (id === undefined) return;
      window.clearInterval(id);
      id = undefined;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stop();
      } else {
        savedCallback.current();
        start();
      }
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [delayMs]);
}

export function visibilityInterval(
  callback: () => void,
  delayMs: number,
): () => void {
  let id: number | undefined;

  function start() {
    if (id !== undefined) return;
    id = window.setInterval(callback, delayMs);
  }

  function stop() {
    if (id === undefined) return;
    window.clearInterval(id);
    id = undefined;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
    } else {
      callback();
      start();
    }
  }

  if (!document.hidden) start();
  document.addEventListener("visibilitychange", onVisibilityChange);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
