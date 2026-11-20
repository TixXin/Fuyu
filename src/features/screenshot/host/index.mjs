import { screenshotActionsV1 } from "@fuyu/plugin-services";
import { createScreenshotActionRegistry } from "./actions.mjs";

export const name = "screenshot";

export function apply(ctx) {
  const registry = createScreenshotActionRegistry();
  const stopAccessor = ctx.reflect.accessor("screenshotActions", {
    get() {
      const caller = this;
      return Object.freeze({
        register: (spec) => {
          const off = registry.register(spec);
          caller.effect(() => off, `screenshotActions.register(${spec?.id ?? ""})`);
          return off;
        },
        list: () => registry.list(),
        run: (id, context) => registry.run(id, context),
      });
    },
  });
  ctx.effect(() => stopAccessor, "screenshotActions.accessor");
  const provider = ctx.services.provide(screenshotActionsV1, {
    list: () => ({ actions: registry.list() }),
    run: (params) => {
      const id = typeof params?.id === "string" ? params.id : "";
      return registry.run(id, params?.context);
    },
  });
  const stopWatching = registry.subscribe(() => provider.emit("changed", { actions: registry.list() }));
  ctx.effect(() => stopWatching, "screenshotActions.changed");
  ctx.provide(
    "screenshot.actions",
    Object.freeze({
      register: (spec) => registry.register(spec),
      list: () => registry.list(),
      run: (id, context) => registry.run(id, context),
    }),
  );
}
