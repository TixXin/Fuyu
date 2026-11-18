import { messagesV1 } from "@fuyu/plugin-services";
import { islandNoticesV1, type IslandNotice } from "../../../lib/island-notices/service";
import { windowServices } from "../../plugin-kernel/services";
import {
  clearMessageSources,
  getMessageSources,
  notifyMessageArrival,
  setMessageArrivalHandler,
  subscribeMessageSources,
} from "../host/sources.mjs";
import { deliverNotice, setNoticeActionSender } from "./notices";
import { OWNER } from "./owner.ts";

function readNotice(params: IslandNotice): IslandNotice {
  const ok = typeof params?.pluginId === "string" && typeof params.title === "string" && typeof params.body === "string" && typeof params.durationMs === "number" && Array.isArray(params.actions);
  if (!ok) throw Object.assign(new Error("a notice needs a plugin id, a title, a body, a duration and a list of actions"), { code: "bad-params" });
  return params;
}

if (new URLSearchParams(window.location.search).get("window") === null) {
  const noticesProvider = windowServices.provide(islandNoticesV1, {
    notify: (params) => ({ shown: deliverNotice(readNotice(params)) }),
  }, { owner: OWNER });

  const messagesProvider = windowServices.provide(messagesV1, {
    sources: () => ({ sources: [...getMessageSources().sources] }),
    notify: (params) => notifyMessageArrival(params),
    clear: (params) => clearMessageSources(params),
  }, { owner: OWNER });

  setMessageArrivalHandler((notice) => {
    const shown = deliverNotice({
      pluginId: notice.pluginId,
      pluginName: null,
      title: notice.title,
      body: notice.body,
      durationMs: notice.durationMs,
      iconUrl: notice.iconUrl,
      layout: notice.layout === "inline" ? "inline" : "card",
      controls: notice.controls,
      actions: notice.actions.map((item) => ({ id: item, title: item })),
    });
    messagesProvider.emit("arrived", notice);
    return shown;
  });

  subscribeMessageSources(() => {
    messagesProvider.emit("changed", {});
  });

  setNoticeActionSender((pluginId, action) => {
    noticesProvider.emit("action", { pluginId, action });
    messagesProvider.emit("action", { pluginId, source: pluginId, action });
  });
}
