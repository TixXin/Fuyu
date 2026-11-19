import { useCallback, useEffect, useRef, useState } from "react";
import type { IslandNotice } from "../../../lib/island-notices/service";
import { onNotice, runNoticeAction } from "../plugin/notices";

export type ShownPluginNotification = IslandNotice & { receivedAt: number };

export type PluginNotificationsController = {
  notification: ShownPluginNotification | null;
  dismiss: () => void;
  runAction: (action: string) => void;
  post: (notification: IslandNotice) => void;
};

export function usePluginNotifications(enabled: boolean, mediaBlocked = false): PluginNotificationsController {
  const [notification, setNotification] = useState<ShownPluginNotification | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const mediaBlockedRef = useRef(mediaBlocked);
  mediaBlockedRef.current = mediaBlocked;

  useEffect(() => {
    if (!enabled) setNotification(null);
  }, [enabled]);

  useEffect(() => onNotice((next) => {
    if (!enabledRef.current) return false;
    if (next.controls === "media" && mediaBlockedRef.current) return false;
    setNotification({ ...next, receivedAt: Date.now() });
    return true;
  }), []);

  useEffect(() => {
    if (!notification) return;
    const timer = window.setTimeout(
      () => setNotification((current) => (current === notification ? null : current)),
      notification.durationMs,
    );
    return () => window.clearTimeout(timer);
  }, [notification]);

  const dismiss = useCallback(() => setNotification(null), []);
  const runAction = useCallback(
    (action: string) => {
      if (!notification) return;
      setNotification(null);
      runNoticeAction(notification.pluginId, action);
    },
    [notification],
  );

  const post = useCallback((next: IslandNotice) => {
    if (enabledRef.current) setNotification({ ...next, receivedAt: Date.now() });
  }, []);

  return { notification, dismiss, runAction, post };
}
