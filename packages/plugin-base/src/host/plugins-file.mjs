import Include from "@cordisjs/include";
import { builtinEntries, withBuiltins } from "./builtins.mjs";
import { withSources } from "./sources.mjs";

export default class PluginsFile extends Include {
  constructor(ctx, config) {
    super(ctx, config);
    const apply = this.root.update.bind(this.root);
    const warn = (text) => this.warn("%s", text);
    const context = { dir: this.config.dir, appVersion: this.config.appVersion ?? undefined };
    this.root.update = (entries) => apply(withSources(withBuiltins(entries, builtinEntries(this.config.builtins), warn), context));
  }

  async reapply() {
    await this.refresh();
    this._scheduleApply();
    await this.flush();
  }
}
