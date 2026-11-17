import { useEffect } from "react";
import { islandNoticesV1 } from "../../../lib/island-notices/service";
import { windowServices } from "../../plugin-kernel/services";
import { defineSlot } from "../../plugin-kernel/slots";
import { listenPluginNotifications, runPluginNotificationAction } from "../api";

const notices = windowServices.get(islandNoticesV1);

export function PluginNoticesRunner() {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const offAction = notices.on("action", ({ pluginId, action }) => {
      void runPluginNotificationAction(pluginId, action).catch((error: unknown) => console.error("Failed to run a plugin notification action", error));
    });
    void listenPluginNotifications((notification) => {
      void notices.notify(notification).catch(() => undefined);
    })
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => console.error("Failed to listen for plugin notifications", error));
    return () => {
      cancelled = true;
      unlisten?.();
      void offAction();
    };
  }, []);
  return null;
}

defineSlot("island.runner/v1").add({ id: "plugins.notices", component: PluginNoticesRunner });
