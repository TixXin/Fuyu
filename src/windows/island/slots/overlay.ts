import type { ComponentProps } from "react";
import type { MessageBanner } from "../../../features/messages/banner/MessageBanner";
import { defineSlot } from "../../../features/plugin-kernel/slots";

export type OverlaySources = {
  messageBanner: ComponentProps<typeof MessageBanner> | null;
};

export const overlaySlot = defineSlot<OverlaySources>("island.overlay/v1");
