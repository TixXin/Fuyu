import { Service } from "cordis";

export class HostBridge extends Service {
  constructor(ctx, bridge) {
    super(ctx, "host");
    this.bridge = bridge;
  }

  call(method, params) {
    return this.bridge.call(this.ctx.fiber.name, method, params);
  }

  on(topic, listener) {
    const plugin = this.ctx.fiber.name;
    return this.ctx.effect(
      () =>
        this.bridge.subscribe((message) => {
          if (message.plugin === plugin && message.topic === topic) listener(message.data);
        }),
      `ctx.host.on(${topic})`,
    );
  }
}

export function createBridge(call) {
  const listeners = new Set();
  return {
    call: (plugin, method, params) => call("plugin.call", { plugin, method, params }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    deliver(message) {
      for (const listener of listeners) listener(message);
    },
  };
}
