import { Gauge } from "lucide-react";
import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { USAGE_PROVIDERS, usageItemId } from "../usageRing.ts";
import { OWNER } from "./owner.ts";

export const islandWidgets: readonly BuiltinWidget[] = USAGE_PROVIDERS.map((provider, index) => ({
  id: usageItemId(provider),
  owner: OWNER,
  icon: Gauge,
  group: "usage",
  sizes: ["bar", "s"],
  order: 50 + index,
  label: (t) => t.islandWidgets.widgets.usage(provider.name),
}));
