import type { ServiceClient, ServiceDefinitionLike, ServiceEntry, ServiceImpl, ServiceProvider } from "../services.mjs";
import type { ServiceProxy } from "./services.mjs";

export interface WindowProvideOptions {
  /** The built-in plugin that provides it. While that plugin is switched off, callers get `not-ready`. Defaults to the table's owner. */
  owner?: string;
}

/**
 * The service table of one window. A call goes to a provider in this window first, then to the plugin host
 * over its socket, and fails with `not-ready` when neither has one. Errors carry the host's codes.
 */
export interface WindowServices {
  provide<S extends ServiceDefinitionLike>(definition: S, impl: ServiceImpl<S>, options?: WindowProvideOptions): ServiceProvider<S>;
  get<S extends ServiceDefinitionLike>(definition: S): ServiceClient<S>;
  /** Route what this window does not provide to the host's service proxy, or stop doing so with `null`. */
  attach(proxy: ServiceProxy | null): void;
  setDisabledOwners(ids: Iterable<string>): void;
  setDisabledServices(names: Iterable<string>): void;
  /** The services provided in this window right now. */
  list(): ServiceEntry[];
  has(name: string): boolean;
  owned(owner: string): { services: number };
  listeners(): number;
  watch(watcher: (list: ServiceEntry[]) => void): () => void;
}

export function createWindowServices(options?: { remote?: ServiceProxy | null; owner?: string }): WindowServices;
