import type { ServiceClient, ServiceDefinitionLike, ServiceEntry } from "../services.mjs";

export type ServiceCall = (method: "service.call" | "service.on" | "service.off", params: unknown, options?: { timeoutMs?: number }) => Promise<any>;

export interface ServiceEventMessage {
  service: string;
  event: string;
  data: unknown;
}

/**
 * The window side of services. Feed it the host's `service` events (`deliver`), the `services` list from the
 * snapshot and its updates (`update`), and call `resubscribe` after every fresh snapshot, since the host
 * forgets a window's events when it reconnects.
 */
export interface ServiceProxy {
  get<S extends ServiceDefinitionLike>(definition: S): ServiceClient<S>;
  deliver(message: ServiceEventMessage): void;
  resubscribe(): Promise<void>;
  update(list: ServiceEntry[]): void;
  list(): ServiceEntry[];
  has(name: string): boolean;
  watch(watcher: (list: ServiceEntry[]) => void): () => void;
  subscriptions(): number;
}

export function createServiceProxy(call: ServiceCall): ServiceProxy;
