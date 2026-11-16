import { todosV1, type ServiceImpl } from "@fuyu/plugin-services";
import { windowServices } from "../../plugin-kernel/services";
import { METHODS, fromAnswer, paramsOf } from "../host/index.mjs";
import { onTodosChanged, todoApi } from "./todoApi";
import { OWNER } from "./owner.ts";

type Method = keyof typeof METHODS;

function call(method: Method) {
  return async (params: unknown) => {
    const handlers = todoApi.get();
    if (!handlers) throw Object.assign(new Error(`todos/v1 ${method}: the todo list is not loaded`), { code: "not-ready" });
    return fromAnswer(method, handlers[METHODS[method]](paramsOf(params)));
  };
}

if (new URLSearchParams(window.location.search).get("window") === null) {
  const provider = windowServices.provide(todosV1, {
    list: call("list"),
    days: call("days"),
    add: call("add"),
    update: call("update"),
    remove: call("remove"),
    note: call("note"),
    setNote: call("setNote"),
  } as ServiceImpl<typeof todosV1>, { owner: OWNER });
  onTodosChanged((change) => provider.emit("changed", change));
}
