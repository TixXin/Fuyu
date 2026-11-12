import { useCallback, useEffect, useRef, useState } from "react";
import { listenPluginNotifications, runPluginNotificationAction, type PluginNotification } from "./api";

export type ShownPluginNotification = PluginNotification & { receivedAt: number };

export type PluginNotificationsController = {
  notification: ShownPluginNotification | null;
  dismiss: () => void;
  runAction: (action: string) => void;
  post: (notification: PluginNotification) => void;
};

export function usePluginNotifications(enabled: boolean): PluginNotificationsController {
  const [notification, setNotification] = useState<ShownPluginNotification | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) setNotification(null);
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenPluginNotifications((next) => {
      if (enabledRef.current) setNotification({ ...next, receivedAt: Date.now() });
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for plugin notifications", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

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
      void runPluginNotificationAction(notification.pluginId, action).catch((error: unknown) =>
        console.error("Failed to run a plugin notification action", error),
      );
    },
    [notification],
  );

  const post = useCallback((next: PluginNotification) => {
    if (enabledRef.current) setNotification({ ...next, receivedAt: Date.now() });
  }, []);

  return { notification, dismiss, runAction, post };
}
