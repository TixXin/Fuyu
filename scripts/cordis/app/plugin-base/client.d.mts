export interface AppClientService {
  name: string;
  service: any;
  options(options: Record<string, any>): unknown;
}

export interface AppLoaderOptions {}

export declare const APP_CLIENT_SERVICES: readonly AppClientService[];
