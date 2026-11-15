import { ownerOf } from "./owner.mjs";

function owner(ctx) {
  return ownerOf(ctx.fiber) ?? ctx.fiber.name;
}

export class Timers {
  constructor(usage = null) {
    this.live = new Map();
    this.usage = usage;
  }

  timed(owner, callback) {
    return this.usage ? this.usage.wrap(owner, callback) : callback;
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
    const id = owner(ctx);
    const run = this.timed(id, callback);
    const dispose = ctx.effect(() => {
      let done = false;
      const handle = setTimeout(() => {
        done = true;
        this.track(id, -1);
        void dispose();
        run(...args);
      }, ms);
      this.track(id, 1);
      return () => {
        if (done) return;
        done = true;
        clearTimeout(handle);
        this.track(id, -1);
      };
    }, "ctx.setTimeout()");
    return dispose;
  }

  setInterval(ctx, callback, ms, ...args) {
    const id = owner(ctx);
    const run = this.timed(id, callback);
    return ctx.effect(() => {
      const handle = setInterval(run, ms, ...args);
      this.track(id, 1);
      return () => {
        clearInterval(handle);
        this.track(id, -1);
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
