import { messagesV1 } from "@fuyu/plugin-services";
import { createMessageSourceRegistry } from "./sources.mjs";

export const name = "messages";

export function apply(ctx) {
  let provider = null;
  const registry = createMessageSourceRegistry({
    onChange: () => {
      provider?.emit("changed", {});
    },
    onArrive: (notice) => {
      provider?.emit("arrived", notice);
      return true;
    },
  });

  const stopAccessor = ctx.reflect.accessor("messageSources", {
    get() {
      const caller = this;
      return Object.freeze({
        register: (spec) => {
          const off = registry.register(spec);
          caller.effect(() => off, `messageSources.register(${spec?.id ?? ""})`);
          return off;
        },
        sources: () => registry.sources(),
        notify: (notice) => registry.notify(notice),
        clear: (params) => registry.clear(params),
      });
    },
  });
  ctx.effect(() => stopAccessor, "messageSources.accessor");
  ctx.provide(
    "messages.sources",
    Object.freeze({
      register: (spec) => registry.register(spec),
      sources: () => registry.sources(),
      notify: (notice) => registry.notify(notice),
      clear: (params) => registry.clear(params),
    }),
  );

  provider = ctx.services.provide(messagesV1, {
    sources: () => ({ sources: [...registry.sources().sources] }),
    notify: (notice) => registry.notify(notice),
    clear: (params) => registry.clear(params),
  });
}
