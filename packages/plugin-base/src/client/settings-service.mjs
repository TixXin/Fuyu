import { Service } from "cordis";

export class PluginSettings extends Service {
  constructor(ctx, options) {
    super(ctx, "settings");
    this.opener = options?.open ?? null;
  }

  async open() {
    if (!this.opener) throw Object.assign(new Error("this window cannot open the settings"), { code: "not-ready" });
    await this.opener(this.ctx.fiber.name);
  }
}
