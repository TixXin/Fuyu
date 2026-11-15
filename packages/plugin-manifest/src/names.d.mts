export declare const SERVICE_NAME: RegExp;

export interface PluginName {
  scope: string | null;
  name: string;
}

export interface RepositoryRef {
  host: string;
  owner: string;
  repo: string;
}

export declare function parsePluginName(name: unknown): PluginName | null;
export declare function parseRepository(repository: unknown): RepositoryRef | null;
export declare function checkPluginName(
  name: string,
  repository: unknown,
  options?: { officialScope?: string; official?: boolean },
): { code: string; message: string } | null;
