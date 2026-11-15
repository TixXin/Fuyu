import type { Context } from "@fuyu/plugin-base";
import { timersV1 } from "@fuyu/plugin-services";
import { COUNTDOWN_MS, METHODS, TOPICS, isTicking, type TimerList } from "./timers.ts";

export const name = "{{name}}";
export const inject = ["clients", "timers/v1"];

export function apply(ctx: Context) {
  const timers = ctx.services.get(timersV1);
  let latest: TimerList = { timers: [], at: 0 };
  let stopTicking: (() => Promise<void>) | null = null;

  const now = (): TimerList => ({ timers: latest.timers, at: Date.now() });
  const publish = () => ctx.clients.publish(TOPICS.timers, now());

  function update(list: TimerList) {
    if (list.at < latest.at) return;
    latest = list;
    publish();
    const ticking = list.timers.some((timer) => isTicking(timer, list.at));
    if (ticking && !stopTicking) stopTicking = ctx.setInterval(publish, 1000);
    if (!ticking && stopTicking) {
      void stopTicking();
      stopTicking = null;
    }
  }

  timers.on("changed", update);
  void timers.list().then(update);

  ctx.clients.handle(METHODS.list, now);
  ctx.clients.handle(METHODS.start, () => timers.start({ kind: "countdown", durationMs: COUNTDOWN_MS }));
  ctx.clients.handle(METHODS.dismiss, () => timers.dismissRinging());
}
