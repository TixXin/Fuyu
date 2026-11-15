import type { EventOptions, Json, ServiceDefinitionLike } from "@fuyu/plugin-base";

export type { Caller, CallOptions, EventOptions, EventsOf, Json, MethodOptions, MethodsOf, ProgressOf, ServiceClient, ServiceErrorCode, ServiceErrorShape, ServiceImpl, ServiceProvider } from "@fuyu/plugin-base";

export const SERVICE_NAME: RegExp;
export const MEMBER_NAME: RegExp;
export const RESERVED_MEMBERS: readonly ["on", "then", "catch", "finally", "constructor", "toJSON", "toString", "valueOf"];
export const DEFAULT_TIMEOUT_MS: 30000;

type Reserved = (typeof RESERVED_MEMBERS)[number];
type Fn = (...args: any[]) => any;

type JsonParams<A> = A extends [] ? true : A extends [(infer P)?] ? (P extends Json | undefined ? true : false) : false;
type JsonResult<R> = [Awaited<R>] extends [Json | void] ? true : false;

export type MethodTable<M> = {
  [K in keyof M]: K extends Reserved
    ? never
    : M[K] extends (...args: infer A) => infer R
      ? JsonParams<A> extends true
        ? JsonResult<R> extends true
          ? M[K]
          : (...args: A) => Json
        : (params?: Json) => R
      : Fn;
};

export type EventTable<E> = { [K in keyof E]: K extends Reserved ? never : E[K] extends Json ? E[K] : Json };

export type ProgressTable<M, P> = { [K in keyof P]: K extends keyof M ? (P[K] extends Json ? P[K] : Json) : never };

export interface ServiceDefinition<M = any, E = any, P = any> extends ServiceDefinitionLike<M, E, P> {
  readonly base: string;
  readonly version: number;
}

export interface ServiceSpec<M, E, P> {
  methods: { [K in keyof M]-?: K extends keyof P ? { timeoutMs?: number; progress: true } : true | { timeoutMs?: number } };
  events?: { [K in keyof E]-?: true | EventOptions };
}

export function defineService<M extends MethodTable<M>, E extends EventTable<E> = {}, P extends ProgressTable<M, P> = {}>(
  name: string,
  spec: ServiceSpec<M, E, P>,
): ServiceDefinition<M, E, P>;

export function isServiceDefinition(value: unknown): value is ServiceDefinition;
