import { calendarV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { getCalendarEvents, listCalendarSources } from "../api";
import { fromRust, refreshOf, serviceEvents, serviceSources } from "../host/index.mjs";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  if (!isNativeError(error)) throw fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  throw fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

windowServices.provide(calendarV1, {
  events: async (params) => serviceEvents(await getCalendarEvents(refreshOf(params)).catch(failed)),
  sources: async () => serviceSources(await listCalendarSources().catch(failed)),
}, { owner: OWNER });
