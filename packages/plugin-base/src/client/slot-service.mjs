import { Service } from "cordis";

export class Slots extends Service {
  constructor(ctx, registry) {
    super(ctx, "slots");
    this.registry = registry;
  }

  add(name, item) {
    const owner = this.ctx.fiber.name;
    return this.ctx.effect(() => this.registry.add(name, item, owner), `ctx.slots.add(${name})`);
  }
}
