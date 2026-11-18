import { clipboardV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { addClipboardHistoryText, getClipboardTexts, pasteClipboardText } from "../api";
import { copyParamsOf, fromRust, limitOf, pasteParamsOf, serviceTexts } from "../host/index.mjs";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  if (!isNativeError(error)) throw fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  throw fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

windowServices.provide(clipboardV1, {
  history: async (params) => serviceTexts(await getClipboardTexts(limitOf(params)).catch(failed)),
  copyText: async (params) => {
    const { text } = copyParamsOf(params);
    await addClipboardHistoryText(text).catch(failed);
    return { ok: true as const };
  },
  pasteText: async (params) => {
    const { text, enter } = pasteParamsOf(params);
    await pasteClipboardText(text, enter).catch(failed);
    return { ok: true as const };
  },
}, { owner: OWNER });
