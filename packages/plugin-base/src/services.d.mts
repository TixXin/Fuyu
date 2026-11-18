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

export { SERVICE_NAME } from "./protocol.mjs";
export declare const MEMBER_NAME: RegExp;
export declare const RESERVED_MEMBERS: readonly ["on", "then", "catch", "finally", "constructor", "toJSON", "toString", "valueOf"];
export declare const DEFAULT_TIMEOUT_MS: 30000;

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

export declare function defineService<M extends MethodTable<M>, E extends EventTable<E> = {}, P extends ProgressTable<M, P> = {}>(
  name: string,
  spec: ServiceSpec<M, E, P>,
): ServiceDefinition<M, E, P>;

export declare function isServiceDefinition(value: unknown): value is ServiceDefinition;

export type CommandItem = {
  pluginId: string;
  pluginName: Record<string, string> | null;
  id: string;
  title: Record<string, string>;
  defaultKeybinding: string | null;
  keybinding: string | null;
  active: boolean;
  conflicts: string[];
};

export type CommandsMethods = {
  list(): { items: CommandItem[] };
  run(params: { plugin: string; command: string; args?: Json }): Json;
  setKeybinding(params: { plugin: string; command: string; keybinding: string | null }): { items: CommandItem[] };
};

export type CommandsEvents = {
  changed: { items: CommandItem[] };
};

export declare const commandsV1: ServiceDefinition<CommandsMethods, CommandsEvents, {}>;

export type PluginConfigPropertySchema = {
  type: "boolean" | "string" | "number" | "integer";
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;
  default?: boolean | string | number;
  enum?: Array<string | number>;
  minimum?: number;
  maximum?: number;
};

export type PluginConfigSchema = {
  type?: "object";
  properties?: Record<string, PluginConfigPropertySchema>;
  [key: string]: Json | undefined;
};

export type PluginConfigValues = Record<string, Json>;

export type PluginConfigEntry = {
  id: string;
  schema: PluginConfigSchema | null;
  values: PluginConfigValues;
  defaults: PluginConfigValues;
};

export type PluginConfigMethods = {
  list(): { items: PluginConfigEntry[] };
  get(params: { id: string }): PluginConfigEntry;
  set(params: { id: string; values: PluginConfigValues }): PluginConfigEntry;
  reset(params: { id: string }): PluginConfigEntry;
};

export type PluginConfigEvents = {
  changed: { id: string; values: PluginConfigValues };
};

export declare const pluginConfigV1: ServiceDefinition<PluginConfigMethods, PluginConfigEvents, {}>;

export type PluginWindowRules = {
  disallowAlwaysOnTop: boolean;
  disallowClickThrough: boolean;
  hideAll: boolean;
};

export type PluginWindowState = {
  pluginId: string;
  id: string;
  title: string;
  kind: string;
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  alwaysOnTop: boolean;
  clickThrough: boolean;
  resizable: boolean;
  visible: boolean;
};

export type PluginWindowsMethods = {
  getRules(params: { id: string }): PluginWindowRules;
  setRules(params: { id: string; disallowAlwaysOnTop?: boolean; disallowClickThrough?: boolean; hideAll?: boolean }): PluginWindowRules;
  list(params?: { id?: string }): { items: PluginWindowState[] };
};

export type PluginWindowsEvents = {
  changed: { items: PluginWindowState[]; rules?: { id: string } & PluginWindowRules };
};

export declare const pluginWindowsV1: ServiceDefinition<PluginWindowsMethods, PluginWindowsEvents, {}>;
