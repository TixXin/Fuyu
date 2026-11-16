import { defineSlot } from "../../plugin-kernel/slots";
import type { DeviceUse } from "../api";
import { DeviceUseIndicator } from "../DeviceUseIndicator";

type SideContext = {
  deviceUse: DeviceUse;
};

const sideSlot = defineSlot<SideContext>("island.side/v1");

function CameraRow({ deviceUse }: SideContext) {
  return <DeviceUseIndicator deviceUse={{ ...deviceUse, microphone: [] }} />;
}

function MicrophoneRow({ deviceUse }: SideContext) {
  return <DeviceUseIndicator deviceUse={{ ...deviceUse, camera: [] }} />;
}

sideSlot.add({ id: "device-camera", order: 70, component: CameraRow });
sideSlot.add({ id: "device-microphone", order: 71, component: MicrophoneRow });
