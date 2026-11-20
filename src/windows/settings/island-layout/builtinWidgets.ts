import type { BuiltinWidget } from "../../../features/plugin-kernel/widgetCatalog";

const modules = import.meta.glob<{ islandWidgets: readonly BuiltinWidget[] }>("../../../features/*/plugin/widgets.ts", { eager: true });

export const BUILTIN_WIDGETS: readonly BuiltinWidget[] = Object.values(modules)
  .flatMap((module) => module.islandWidgets)
  .sort((a, b) => a.order - b.order);
