import { defineSlot } from "../../plugin-kernel/slots";
import { MessageBanner } from "../banner/MessageBanner";
import { messagesIsland } from "./islandState";

const overlaySlot = defineSlot<object>("island.overlay/v1");

function BannerOverlay() {
  const banner = messagesIsland.use()?.banner;
  return banner ? <MessageBanner {...banner} /> : null;
}

overlaySlot.add({ id: "messages.banner", component: BannerOverlay });
