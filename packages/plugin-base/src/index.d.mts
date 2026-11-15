export { Context, Service } from "cordis";

declare module "cordis" {
  interface Context {
    clients: {
      add(window: string, url: string): () => Promise<void>;
    };
  }
}
