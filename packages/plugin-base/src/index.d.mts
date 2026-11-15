export { Context, Service } from "cordis";

declare module "cordis" {
  interface Context {
    setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): () => Promise<void>;
    setInterval(callback: (...args: any[]) => void, ms: number, ...args: any[]): () => Promise<void>;
    sleep(ms: number): Promise<void>;
    clients: {
      add(window: string, url: string): () => Promise<void>;
      handle(method: string, handler: (params: any, caller: { window: string }) => unknown): () => Promise<void>;
      publish(topic: string, data?: unknown): void;
    };
    host: {
      call<T = unknown>(method: string, params?: unknown): Promise<T>;
      on(topic: string, listener: (data: any) => void): () => Promise<void>;
    };
    slots: {
      add(name: string, item: { id: string; order?: number; component: unknown }): () => Promise<void>;
    };
  }
}
