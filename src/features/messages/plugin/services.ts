import { islandNoticesV1, type IslandNotice } from "../../../lib/island-notices/service";
import { windowServices } from "../../plugin-kernel/services";
import { deliverNotice, setNoticeActionSender } from "./notices";
import { OWNER } from "./owner.ts";

function readNotice(params: IslandNotice): IslandNotice {
  const ok = typeof params?.pluginId === "string" && typeof params.title === "string" && typeof params.body === "string" && typeof params.durationMs === "number" && Array.isArray(params.actions);
  if (!ok) throw Object.assign(new Error("a notice needs a plugin id, a title, a body, a duration and a list of actions"), { code: "bad-params" });
  return params;
}

if (new URLSearchParams(window.location.search).get("window") === null) {
  const provider = windowServices.provide(islandNoticesV1, {
    notify: (params) => ({ shown: deliverNotice(readNotice(params)) }),
  }, { owner: OWNER });
  setNoticeActionSender((pluginId, action) => { provider.emit("action", { pluginId, action }); });
}
