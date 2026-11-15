export type Json = null | boolean | number | string | readonly Json[] | { readonly [key: string]: Json };

export interface MethodOptions {
  readonly timeoutMs?: number;
  readonly progress?: true;
}

export interface EventOptions {}

/**
 * What `defineService` returns: a versioned name and the methods and events it declares.
 * `types` exists only in the type system and carries the method, event and progress types.
 */
export interface ServiceDefinitionLike<M = any, E = any, P = any> {
  readonly name: string;
  readonly methods: { readonly [K in keyof M]: MethodOptions };
  readonly events: { readonly [K in keyof E]: EventOptions };
  readonly types?: { methods: M; events: E; progress: P };
}

type TypesOf<S> = S extends { readonly types?: infer T } ? NonNullable<T> : {};
type Members<S, K extends "methods" | "events"> = S extends { readonly [Key in K]: infer T } ? keyof T : never;

export type MethodsOf<S> = TypesOf<S> extends { methods: infer M } ? M : { [K in Members<S, "methods">]: (params?: any) => any };
export type EventsOf<S> = TypesOf<S> extends { events: infer E } ? E : { [K in Members<S, "events">]: any };
export type ProgressOf<S> = TypesOf<S> extends { progress: infer P } ? P : { [K in Members<S, "methods">]: any };

type ParamOf<F> = F extends (...args: infer A) => any ? (A extends [] ? undefined : A extends [(infer P)?] ? P : never) : never;
type ResultOf<F> = F extends (...args: any[]) => infer R ? Awaited<R> : never;
type ChunkOf<P, K> = K extends keyof P ? P[K] : never;

export interface Caller<Chunk = never> {
  readonly plugin?: string;
  readonly window?: string;
  progress(chunk: Chunk): void;
}

export type CallOptions<Chunk = never> = { timeoutMs?: number } & ([Chunk] extends [never] ? { onProgress?: undefined } : { onProgress?: (chunk: Chunk) => void });

/** What a provider writes: each declared method, given the params and who called. */
export type ServiceImpl<S> = {
  [K in keyof MethodsOf<S>]: (params: ParamOf<MethodsOf<S>[K]>, caller: Caller<ChunkOf<ProgressOf<S>, K>>) => ResultOf<MethodsOf<S>[K]> | Promise<ResultOf<MethodsOf<S>[K]>>;
};

/** What a user gets: every declared method returns a promise, wherever it is called from. */
export type ServiceClient<S> = {
  readonly [K in keyof MethodsOf<S>]: undefined extends ParamOf<MethodsOf<S>[K]>
    ? (params?: ParamOf<MethodsOf<S>[K]>, options?: CallOptions<ChunkOf<ProgressOf<S>, K>>) => Promise<ResultOf<MethodsOf<S>[K]>>
    : (params: ParamOf<MethodsOf<S>[K]>, options?: CallOptions<ChunkOf<ProgressOf<S>, K>>) => Promise<ResultOf<MethodsOf<S>[K]>>;
} & {
  on<K extends keyof EventsOf<S> & string>(event: K, listener: (data: EventsOf<S>[K]) => void): () => Promise<void>;
};

/** What `provide` returns: send the service's events, or stop providing it. */
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

/** One service that is being provided right now, as windows see it in the snapshot. */
export interface ServiceEntry {
  name: string;
  plugin: string;
  methods: string[];
  events: string[];
}

/** `ctx.services` in the host: provide a declared service, or use one by its definition. */
export interface ServicesApi {
  provide<S extends ServiceDefinitionLike>(definition: S, impl: ServiceImpl<S>): ServiceProvider<S>;
  get<S extends ServiceDefinitionLike>(definition: S): ServiceClient<S>;
  list(): ServiceEntry[];
}
