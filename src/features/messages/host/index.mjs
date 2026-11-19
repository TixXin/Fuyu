import { messagesV1 } from "@fuyu/plugin-services";
import { createMessageSourceRegistry } from "./sources.mjs";

export const name = "messages";
export const inject = { island: { required: false } };

function islandOf(ctx) {
  const island = ctx.island;
  return island && typeof island.notify === "function" ? island : null;
}

export function apply(ctx, config = {}) {
  let provider = null;
  const registry = createMessageSourceRegistry({
    config,
    onChange: () => {
      provider?.emit("changed", {});
    },
    onArrive: (notice) => {
      provider?.emit("arrived", notice);
      return islandOf(ctx)?.notify(notice) ?? false;
    },
  });
  islandOf(ctx)?.onNoticeAction(({ pluginId, action }) => {
    provider?.emit("action", { pluginId, source: pluginId, action });
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
