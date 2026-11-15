export { SERVICE_NAME } from "@fuyu/plugin-manifest/names";
export declare const HOST_PROTOCOL: 2;
export declare const WINDOW_PROTOCOL: 1;
export declare const CLOSE: {
  readonly stopping: 4000;
  readonly badToken: 4401;
  readonly badOrigin: 4403;
  readonly noHello: 4408;
  readonly badProtocol: 4426;
};
export declare const SERVICE_CALLS: readonly ["service.call", "service.on", "service.off"];
export type ServiceCallName = (typeof SERVICE_CALLS)[number];
export declare const SERVICE_TIMEOUT_MS: 30000;
export declare const WINDOW_ORIGINS: readonly string[];
export declare const SLOT_THEME: readonly string[];
export declare const SHARED_MODULES: {
  readonly react: "__shared/react.js";
  readonly "react/jsx-runtime": "__shared/react-jsx-runtime.js";
};
export declare const HOST_SHARED_MODULES: readonly ["@fuyu/plugin-base", "fuyu-plugin", "@fuyu/plugin-base/services"];
export interface SlotDefinition {
  readonly kind: "list" | "single";
  readonly max?: number;
  readonly perPlugin: number;
  readonly groupBy?: string;
  readonly meta: readonly string[];
}
export type SlotName =
  | "island.page/v1"
  | "island.header/v1"
  | "island.collapsed/v1"
  | "island.collapsed-center/v1"
  | "island.alert/v1"
  | "island.dev/v1"
  | "settings.category/v1"
  | "settings.section/v1";
export declare const SLOTS: { readonly [Name in SlotName]: SlotDefinition };
