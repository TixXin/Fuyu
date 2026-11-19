import { islandNoticesV1 } from "../../lib/island-notices/service";
import { isPluginNoticeMuted, rememberNoticeSender } from "../../lib/plugin-notice-mutes/storage.ts";
import { windowServices } from "../plugin-kernel/services";
import type { LocalApiHandlers } from "./dispatch";
import { showLocalApiNotice } from "./notice.ts";
import { failedAnswer } from "./todoHandlers";

export function noticeHandlers(): LocalApiHandlers {
  const notices = windowServices.get(islandNoticesV1);
  return {
    notify: (params) =>
      showLocalApiNotice(params, {
        remember: rememberNoticeSender,
        muted: isPluginNoticeMuted,
        show: (notice) => notices.notify(notice),
        now: Date.now,
      }).catch(failedAnswer),
  };
}
