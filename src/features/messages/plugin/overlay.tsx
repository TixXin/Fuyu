import type { ComponentProps } from "react";
import { defineSlot } from "../../plugin-kernel/slots";
import { MessageBanner } from "../banner/MessageBanner";

type OverlayContext = {
  messageBanner: ComponentProps<typeof MessageBanner> | null;
};

const overlaySlot = defineSlot<OverlayContext>("island.overlay/v1");

function BannerOverlay({ messageBanner }: OverlayContext) {
  return messageBanner ? <MessageBanner {...messageBanner} /> : null;
}

overlaySlot.add({ id: "messages.banner", component: BannerOverlay });
