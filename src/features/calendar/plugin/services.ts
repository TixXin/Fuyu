import { calendarV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { getCalendarEvents, listCalendarSources } from "../api";
import { fromRust, refreshOf, serviceEvents, serviceSources } from "../host/index.mjs";
import { calendarSources, mergeCalendarEvents, mergeCalendarSources, registerCalendarSource, subscribeCalendarSources } from "../host/sources.mjs";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  if (!isNativeError(error)) throw fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  throw fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

const provider = windowServices.provide(calendarV1, {
  events: async (params) => {
    const refresh = refreshOf(params);
    const base = serviceEvents(await getCalendarEvents(refresh).catch(failed));
    return mergeCalendarEvents(base, calendarSources, refresh);
  },
  sources: async () => {
    const base = serviceSources(await listCalendarSources().catch(failed));
    return mergeCalendarSources(base, calendarSources);
  },
}, { owner: OWNER });

calendarSources.subscribe(() => {
  provider.emit("changed", {});
});

export { calendarSources, registerCalendarSource, subscribeCalendarSources };
