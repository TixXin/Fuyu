import { Service } from "cordis";

const failure = (code, message) => Object.assign(new Error(message), { code });

export class PluginIsland extends Service {
  constructor(ctx, options) {
    super(ctx, "island");
    this.control = options?.control ?? null;
  }

  async open(page) {
    if (!this.control) throw failure("not-ready", "this window cannot reach the island");
    if (page !== undefined && page !== null && (typeof page !== "string" || page === "")) throw failure("bad-params", "page must be the id of one of this plugin's island pages");
    await this.control.open(this.ctx.fiber.name, page ?? undefined);
  }

  async collapse() {
    if (!this.control) throw failure("not-ready", "this window cannot reach the island");
    return (await this.control.collapse(this.ctx.fiber.name)) === true;
  }
}
