import { Service } from "cordis";
import { createLocaleStore } from "../locale.mjs";

export class PluginLocale extends Service {
  constructor(ctx, store) {
    super(ctx, "locale");
    this.store = store ?? createLocaleStore();
  }

  get current() {
    return this.store.current();
  }

  onChange(listener) {
    if (typeof listener !== "function") throw new TypeError("ctx.locale.onChange requires a listener function");
    return this.ctx.effect(() => this.store.onChange(listener), "ctx.locale.onChange");
  }

  pick(map) {
    return this.store.pick(map);
  }
}
