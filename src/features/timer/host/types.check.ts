import type { Timer as ServiceTimer, TimerKind as ServiceTimerKind } from "@fuyu/plugin-services";
import type { Timer, TimerKind } from "../timers.ts";

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

export type TimerMatchesService = Expect<Same<Timer, ServiceTimer>>;
export type TimerKindMatchesService = Expect<Same<TimerKind, ServiceTimerKind>>;
