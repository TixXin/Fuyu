import type { ComponentProps } from "react";
import { defineSlot, type IslandCollapsedCenterMeta } from "../../plugin-kernel/slots";
import { CollapsedCenter, centerWidth } from "../index";

type CenterContext = ComponentProps<typeof CollapsedCenter> & { enabled: boolean };

const centerSlot = defineSlot<CenterContext, IslandCollapsedCenterMeta<CenterContext>>("island.collapsed-center/v1");

centerSlot.add({
  id: "center-pattern",
  shown: ({ enabled }) => enabled,
  width: ({ choice, sheet, size }) => centerWidth(typeof sheet === "string" && sheet ? "pet" : choice.pattern === "pet" ? "eyes" : choice.pattern, size),
  component: CollapsedCenter,
});
