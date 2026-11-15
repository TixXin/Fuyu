export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

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

export interface MethodOptions {
  readonly timeoutMs?: number;
  readonly progress?: true;
}

export interface EventOptions {}

export interface ServiceDefinition<M = any, E = any, P = any> {
  readonly name: string;
  readonly base: string;
  readonly version: number;
  readonly methods: { readonly [K in keyof M]: MethodOptions };
  readonly events: { readonly [K in keyof E]: EventOptions };
  readonly types?: { methods: M; events: E; progress: P };
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

export type MethodsOf<S> = S extends ServiceDefinition<infer M, any, any> ? M : never;
export type EventsOf<S> = S extends ServiceDefinition<any, infer E, any> ? E : never;
export type ProgressOf<S> = S extends ServiceDefinition<any, any, infer P> ? P : never;

type ParamOf<F> = F extends (...args: infer A) => any ? (A extends [] ? undefined : A extends [(infer P)?] ? P : never) : never;
type ResultOf<F> = F extends (...args: any[]) => infer R ? Awaited<R> : never;
type ChunkOf<P, K> = K extends keyof P ? P[K] : never;

export interface Caller<Chunk = never> {
  readonly plugin?: string;
  readonly window?: string;
  progress(chunk: Chunk): void;
}

export type CallOptions<Chunk = never> = { timeoutMs?: number } & ([Chunk] extends [never] ? { onProgress?: undefined } : { onProgress?: (chunk: Chunk) => void });

export type ServiceImpl<S> = {
  [K in keyof MethodsOf<S>]: (params: ParamOf<MethodsOf<S>[K]>, caller: Caller<ChunkOf<ProgressOf<S>, K>>) => ResultOf<MethodsOf<S>[K]> | Promise<ResultOf<MethodsOf<S>[K]>>;
};

export type ServiceClient<S> = {
  readonly [K in keyof MethodsOf<S>]: undefined extends ParamOf<MethodsOf<S>[K]>
    ? (params?: ParamOf<MethodsOf<S>[K]>, options?: CallOptions<ChunkOf<ProgressOf<S>, K>>) => Promise<ResultOf<MethodsOf<S>[K]>>
    : (params: ParamOf<MethodsOf<S>[K]>, options?: CallOptions<ChunkOf<ProgressOf<S>, K>>) => Promise<ResultOf<MethodsOf<S>[K]>>;
} & {
  on<K extends keyof EventsOf<S> & string>(event: K, listener: (data: EventsOf<S>[K]) => void): () => Promise<void>;
};

export interface ServiceProvider<S> {
  emit<K extends keyof EventsOf<S> & string>(event: K, data: EventsOf<S>[K]): boolean;
  dispose(): Promise<void>;
}

export type ServiceErrorCode = "bad-params" | "not-ready" | "no-method" | "no-event" | "peer-gone" | "timeout" | "bad-result" | "failed";

export interface ServiceErrorShape {
  code: ServiceErrorCode | (string & {});
  message: string;
  data?: Json;
}
