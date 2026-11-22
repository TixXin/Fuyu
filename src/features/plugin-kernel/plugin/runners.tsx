import { useEffect } from "react";
import { onIslandMirrorRequest, onPluginBarUsageRequest, reportPluginBarUsage, sendIslandMirrorFrame } from "../api";
import { measureBarUsage } from "../barMeasure";
import { captureBarMirror } from "../barMirrorCapture";
import { holdBarMirrorWatch, isBarMirrorWatched, onBarMirrorWatch } from "../barMirrorWatch";
import { defineSlot } from "../slots";

const MIRROR_EVERY_MS = 220;
const MIRROR_SETTLE_MS = 650;

function BarUsageReporter() {
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    void onPluginBarUsageRequest((id) => {
      void reportPluginBarUsage(measureBarUsage(id)).catch(() => undefined);
    })
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch((error: unknown) => console.error("Failed to listen for collapsed bar usage requests", error));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
  return null;
}

function BarMirrorReporter() {
  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;
    let last = "";
    let sentAt = 0;
    let timer: number | null = null;
    let settle: number | null = null;
    let observer: MutationObserver | null = null;
    const send = () => {
      timer = null;
      sentAt = performance.now();
      const frame = captureBarMirror();
      const key = JSON.stringify(frame);
      if (key === last) return;
      last = key;
      void sendIslandMirrorFrame(frame).catch(() => undefined);
    };
    const soon = () => {
      if (!isBarMirrorWatched() || timer !== null) return;
      timer = window.setTimeout(send, Math.max(0, MIRROR_EVERY_MS - (performance.now() - sentAt)));
    };
    const changed = () => {
      soon();
      if (settle !== null) window.clearTimeout(settle);
      settle = window.setTimeout(soon, MIRROR_SETTLE_MS);
    };
    const watch = () => {
      if (isBarMirrorWatched() === (observer !== null)) return;
      if (observer) {
        observer.disconnect();
        observer = null;
        window.removeEventListener("resize", changed);
        return;
      }
      observer = new MutationObserver(changed);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      window.addEventListener("resize", changed);
    };
    const unwatch = onBarMirrorWatch(watch);
    void onIslandMirrorRequest(() => {
      holdBarMirrorWatch();
      last = "";
      changed();
    })
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch((error: unknown) => console.error("Failed to listen for island mirror requests", error));
    return () => {
      cancelled = true;
      stop?.();
      unwatch();
      observer?.disconnect();
      window.removeEventListener("resize", changed);
      if (timer !== null) window.clearTimeout(timer);
      if (settle !== null) window.clearTimeout(settle);
    };
  }, []);
  return null;
}

defineSlot("island.runner/v1").add({ id: "plugin-kernel.bar-usage", component: BarUsageReporter });
defineSlot("island.runner/v1").add({ id: "plugin-kernel.bar-mirror", component: BarMirrorReporter });
