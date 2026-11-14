import { useEffect, useRef } from "react";
import { useLocale, useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { hidePluginWebview, showPluginWebview, type PluginWebviewBounds } from "../api";
import "./WebviewTemplate.css";

const FOLLOW_MS = 900;

const sameBounds = (a: PluginWebviewBounds | null, b: PluginWebviewBounds) =>
  a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

export function WebviewTemplate({ pluginId, viewId, active, frameless = false }: {
  pluginId: string;
  viewId: string;
  active: boolean;
  frameless?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const t = useTranslation();
  const { locale } = useLocale();
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    const element = box.current;
    if (!active || !element || isMacOS) return;
    let sent: PluginWebviewBounds | null = null;
    let frame = 0;
    let followUntil = 0;
    const report = () => {
      const rect = element.getBoundingClientRect();
      const bounds = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
      if (sameBounds(sent, bounds)) return;
      sent = bounds;
      const ink = frameless ? getComputedStyle(element).getPropertyValue("--island-ink-rgb").trim() || null : null;
      showPluginWebview(pluginId, viewId, bounds, localeRef.current, ink).catch((error: unknown) => console.error("Failed to show a plugin page", error));
    };
    const follow = (now: number) => {
      report();
      frame = now < followUntil ? requestAnimationFrame(follow) : 0;
    };
    const startFollowing = () => {
      followUntil = performance.now() + FOLLOW_MS;
      if (frame === 0) frame = requestAnimationFrame(follow);
    };
    startFollowing();
    const observer = new ResizeObserver(startFollowing);
    observer.observe(element);
    window.addEventListener("resize", startFollowing);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", startFollowing);
      hidePluginWebview(pluginId, viewId).catch((error: unknown) => console.error("Failed to close a plugin page", error));
    };
  }, [active, frameless, pluginId, viewId]);

  if (isMacOS) return <p className="plugin-webview plugin-webview--unsupported">{t.pluginViews.webviewNotOnMac}</p>;
  return <div ref={box} className="plugin-webview" />;
}
