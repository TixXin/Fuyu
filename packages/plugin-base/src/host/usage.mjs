import { performance } from "node:perf_hooks";
import { ownerOf } from "./owner.mjs";

function round(ms) {
  return Math.round(ms * 100) / 100;
}

export class Usage {
  constructor(onFault) {
    this.onFault = onFault;
    this.cpu = new Map();
    this.applyMs = new Map();
    this.frames = [];
  }

  slot(id) {
    let slot = this.cpu.get(id);
    if (!slot) this.cpu.set(id, (slot = { cpuMs: 0, calls: 0 }));
    return slot;
  }

  time(id, fn, thisArg, args) {
    if (!id) return Reflect.apply(fn, thisArg, args);
    const frame = { child: 0 };
    this.frames.push(frame);
    const start = performance.now();
    try {
      return Reflect.apply(fn, thisArg, args);
    } catch (error) {
      this.onFault?.(id, error);
      throw error;
    } finally {
      const elapsed = performance.now() - start;
      this.frames.pop();
      const slot = this.slot(id);
      slot.cpuMs += Math.max(0, elapsed - frame.child);
      slot.calls += 1;
      const parent = this.frames.at(-1);
      if (parent) parent.child += elapsed;
    }
  }

  wrap(id, fn) {
    const usage = this;
    return function (...args) {
      return usage.time(id, fn, this, args);
    };
  }

  install(ctx) {
    const usage = this;
    const disposers = [
      ctx.on("internal/listener", function (name, listener, options) {
        if (typeof name === "string" && name.startsWith("internal/")) return;
        const id = ownerOf(this.fiber);
        if (!id) return;
        const label = `ctx.on(${typeof name === "string" ? JSON.stringify(name) : name.toString()})`;
        return this.events.register(label, name, usage.wrap(id, listener), options);
      }),
      ctx.on("internal/plugin", (fiber) => {
        if (!fiber.uid || !fiber.runtime || fiber._runner.timed) return;
        usage.timeApply(fiber);
      }),
    ];
    return () => disposers.forEach((dispose) => dispose());
  }

  timeApply(fiber) {
    const usage = this;
    const runner = fiber._runner;
    const execute = runner.execute;
    runner.timed = true;
    runner.execute = function () {
      const id = ownerOf(fiber);
      const top = fiber.entry && fiber.parent.fiber?.entry !== fiber.entry;
      const start = performance.now();
      const done = () => top && usage.applyMs.set(id, round(performance.now() - start));
      let result;
      try {
        result = usage.time(id, execute, this, []);
      } catch (error) {
        done();
        throw error;
      }
      if (result && typeof result.then === "function") result.then(done, done);
      else done();
      return result;
    };
  }

  counts(ctx, timers) {
    const result = new Map();
    const of = (id) => {
      let entry = result.get(id);
      if (!entry) result.set(id, (entry = { timers: 0, listeners: 0, services: 0, clients: 0 }));
      return entry;
    };
    for (const [id, count] of Object.entries(timers)) of(id).timers = count;
    for (const [name, hooks] of Object.entries(ctx.events._hooks)) {
      if (name.startsWith("internal/")) continue;
      for (const hook of hooks) {
        const id = hook.ctx && ownerOf(hook.ctx.fiber);
        if (id) of(id).listeners += 1;
      }
    }
    for (const entry of ctx.loader.entries()) {
      const services = (entry.innerFiber?.provisions?.size ?? 0) + (entry.outerFiber?.provisions?.size ?? 0);
      if (services) of(entry.options.id).services = services;
    }
    for (const client of ctx.clients.list()) of(client.plugin).clients += 1;
    return result;
  }

  report(ctx, timers, faults) {
    const counts = this.counts(ctx, timers);
    return (id) => {
      const cpu = this.cpu.get(id);
      const fault = faults(id);
      return {
        cpuMs: round(cpu?.cpuMs ?? 0),
        calls: cpu?.calls ?? 0,
        applyMs: this.applyMs.get(id) ?? null,
        ...(counts.get(id) ?? { timers: 0, listeners: 0, services: 0, clients: 0 }),
        errors: fault.total,
      };
    };
  }
}
