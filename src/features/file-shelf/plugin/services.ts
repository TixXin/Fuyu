import { fileShelfV1 } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { isNativeError } from "../../../i18n/nativeError";
import { addFileShelfPaths, getFileShelf } from "../api";
import { fromRust, pathsOf, serviceItems } from "../host/index.mjs";
import { OWNER } from "./owner.ts";

function failed(error: unknown): never {
  if (!isNativeError(error)) throw fromRust({ code: undefined, message: error instanceof Error ? error.message : String(error) });
  throw fromRust({ code: error.code, message: error.message, data: { args: error.args, detail: error.detail } });
}

windowServices.provide(fileShelfV1, {
  list: async () => serviceItems(await getFileShelf().catch(failed)),
  add: async (params) => serviceItems(await addFileShelfPaths(pathsOf(params)).catch(failed)),
}, { owner: OWNER });
