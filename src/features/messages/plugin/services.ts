import { messagesV1 } from "@fuyu/plugin-services";
import { islandNoticesV1, type IslandNotice } from "../../../lib/island-notices/service";
import { isPluginNoticeMuted, rememberNoticeSender } from "../../../lib/plugin-notice-mutes/storage.ts";
import { sendIslandNoticeAction, setLocalIslandNotices } from "../../plugin-kernel/islandControl";
import { windowServices } from "../../plugin-kernel/services";
import {
  clearMessageSources,
  getMessageSources,
  normalizeArrivalNotice,
  notifyMessageArrival,
  setMessageArrivalHandler,
  subscribeMessageSources,
  type NormalizedArrivalNotice,
} from "../host/sources.mjs";
import { deliverNotice, setNoticeActionSender } from "./notices";
import { OWNER } from "./owner.ts";

function readNotice(params: IslandNotice): IslandNotice {
  const ok = typeof params?.pluginId === "string" && typeof params.title === "string" && typeof params.body === "string" && typeof params.durationMs === "number" && Array.isArray(params.actions);
  if (!ok) throw Object.assign(new Error("a notice needs a plugin id, a title, a body, a duration and a list of actions"), { code: "bad-params" });
  return params;
}

function arrivalNotice(notice: NormalizedArrivalNotice): IslandNotice {
  return {
    pluginId: notice.pluginId,
    pluginName: null,
    title: notice.title,
    body: notice.body,
    durationMs: notice.durationMs,
    iconUrl: notice.iconUrl,
    layout: notice.layout === "inline" ? "inline" : "card",
    controls: notice.controls,
    actions: notice.actions.map((item) => ({ id: item, title: item })),
  };
}

function deliverPluginNotice(notice: IslandNotice): boolean {
  rememberNoticeSender(notice.pluginId);
  return isPluginNoticeMuted(notice.pluginId) ? false : deliverNotice(notice);
}

const fromHost = new Set<string>();

if (new URLSearchParams(window.location.search).get("window") === null) {
  const noticesProvider = windowServices.provide(islandNoticesV1, {
    notify: (params) => {
      const notice = readNotice(params);
      fromHost.delete(notice.pluginId);
      return { shown: deliverNotice(notice) };
    },
  }, { owner: OWNER });

  const messagesProvider = windowServices.provide(messagesV1, {
    sources: () => ({ sources: [...getMessageSources().sources] }),
    notify: (params) => notifyMessageArrival(params),
    clear: (params) => clearMessageSources(params),
  }, { owner: OWNER });

  setMessageArrivalHandler((notice) => {
    fromHost.delete(notice.pluginId);
    const shown = deliverPluginNotice(arrivalNotice(notice));
    messagesProvider.emit("arrived", notice);
    return shown;
  });

  setLocalIslandNotices((raw) => {
    const notice = normalizeArrivalNotice(raw);
    const shown = deliverPluginNotice(arrivalNotice(notice));
    if (shown) fromHost.add(notice.pluginId);
    return shown;
  });

  subscribeMessageSources(() => {
    messagesProvider.emit("changed", {});
  });

  setNoticeActionSender((pluginId, action) => {
    if (fromHost.has(pluginId)) {
      void sendIslandNoticeAction(pluginId, action).catch((error: unknown) => console.error("Failed to send a notice action to the plugin host", error));
      return;
    }
    noticesProvider.emit("action", { pluginId, action });
    messagesProvider.emit("action", { pluginId, source: pluginId, action });
  });
}
