export type AppEcho = { echo: JsonValue, };

export type AppVersion = { version: string, platform: string, };

export type JsonValue = number | string | boolean | Array<JsonValue> | { [key in string]: JsonValue } | null;

export type PlatformSupport = { os: string, unsupported: Array<string>, devBuild: boolean, };

export type RustMethods = {
  "app.echo": { params: { value: JsonValue }; result: AppEcho };
  "app.platformSupport": { params: Record<string, never> | null; result: PlatformSupport };
  "app.version": { params: Record<string, never> | null; result: AppVersion };
};

export declare const RUST_METHODS: readonly ["app.echo", "app.platformSupport", "app.version"];
