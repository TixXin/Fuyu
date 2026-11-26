export interface AppClientService {
  name: string;
  service: any;
  options(options: Record<string, any>): unknown;
}

export interface IslandControl {
  open(plugin: string, page?: string): Promise<void>;
  collapse(plugin: string): Promise<boolean>;
}

export interface AppLoaderOptions {
  openSettings?: ((plugin: string) => Promise<void> | void) | null;
  reportSetup?: ((plugin: string, state: { needed: boolean; hint?: unknown }) => Promise<unknown> | void) | null;
  island?: IslandControl | null;
}

export declare const APP_CLIENT_SERVICES: readonly AppClientService[];
