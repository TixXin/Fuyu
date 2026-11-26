import { Service } from "cordis";

export class PluginSettings extends Service {
  constructor(ctx, options) {
    super(ctx, "settings");
    this.opener = options?.open ?? null;
    this.reporter = options?.setup ?? null;
  }

  async open() {
    if (!this.opener) throw Object.assign(new Error("this window cannot open the settings"), { code: "not-ready" });
    await this.opener(this.ctx.fiber.name);
  }

  async setup(state) {
    if (!this.reporter) throw Object.assign(new Error("this window cannot report the setup state"), { code: "not-ready" });
    const needed = Boolean(state && typeof state === "object" && state.needed === true);
    await this.reporter(this.ctx.fiber.name, needed ? { needed, hint: state.hint ?? null } : { needed });
  }
}
