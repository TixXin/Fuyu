import { createLocaleStore } from "../locale.mjs";
import { installInjectableAccessor } from "./owner.mjs";

export class HostLocale {
  constructor(initial) {
    this.store = createLocaleStore(initial);
  }

  install(ctx) {
    const store = this.store;
    const unaccess = installInjectableAccessor(ctx, "locale", function () {
      const caller = this;
      return Object.freeze({
        get current() {
          return store.current();
        },
        onChange(listener) {
          if (typeof listener !== "function") throw new TypeError("ctx.locale.onChange requires a listener function");
          return caller.effect(() => store.onChange(listener), "ctx.locale.onChange");
        },
        pick(map) {
          return store.pick(map);
        },
      });
    });
    return () => void unaccess();
  }

  current() {
    return this.store.current();
  }

  set(next) {
    return this.store.set(next);
  }

  watch(listener) {
    return this.store.onChange(listener);
  }
}
