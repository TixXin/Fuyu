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
  ctx.provide(
    "screenshot.actions",
    Object.freeze({
      register: (spec) => registry.register(spec),
      list: () => registry.list(),
      run: (id, context) => registry.run(id, context),
    }),
  );
}
