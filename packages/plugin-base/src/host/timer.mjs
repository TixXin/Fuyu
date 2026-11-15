export class Timers {
  constructor() {
    this.live = new Map();
  }

  install(ctx) {
    const timers = this;
    const disposers = ["setTimeout", "setInterval", "sleep"].map((name) =>
      ctx.reflect.accessor(name, {
        get() {
          return (...args) => timers[name](this, ...args);
        },
      }),
    );
    return () => disposers.forEach((dispose) => dispose());
  }

  track(owner, delta) {
    const count = (this.live.get(owner) ?? 0) + delta;
    if (count > 0) this.live.set(owner, count);
    else this.live.delete(owner);
  }

  setTimeout(ctx, callback, ms = 0, ...args) {
    const owner = ctx.fiber.name;
    const dispose = ctx.effect(() => {
      let done = false;
      const handle = setTimeout(() => {
        done = true;
        this.track(owner, -1);
        void dispose();
        callback(...args);
      }, ms);
      this.track(owner, 1);
      return () => {
        if (done) return;
        done = true;
        clearTimeout(handle);
        this.track(owner, -1);
      };
    }, "ctx.setTimeout()");
    return dispose;
  }

  setInterval(ctx, callback, ms, ...args) {
    const owner = ctx.fiber.name;
    return ctx.effect(() => {
      const handle = setInterval(callback, ms, ...args);
      this.track(owner, 1);
      return () => {
        clearInterval(handle);
        this.track(owner, -1);
      };
    }, "ctx.setInterval()");
  }

  sleep(ctx, ms) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const stop = ctx.effect(() => () => {
        if (settled) return;
        settled = true;
        reject(Object.assign(new Error("the plugin stopped while it was sleeping"), { code: "inactive" }));
      }, "ctx.sleep()");
      this.setTimeout(ctx, () => {
        settled = true;
        void stop();
        resolve();
      }, ms);
    });
  }

  counts() {
    return Object.fromEntries(this.live);
  }
}
