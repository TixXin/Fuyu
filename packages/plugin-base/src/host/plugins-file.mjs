import Include from "@cordisjs/include";
import { withBuiltins } from "./builtins.mjs";

export default class PluginsFile extends Include {
  constructor(ctx, config) {
    super(ctx, config);
    const apply = this.root.update.bind(this.root);
    this.root.update = (entries) => apply(withBuiltins(entries, this.config.builtins ?? [], (text) => this.warn("%s", text)));
  }
}
