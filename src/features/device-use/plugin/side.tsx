import { defineSlot } from "../../plugin-kernel/slots";
import { DeviceUseIndicator } from "../DeviceUseIndicator";
import { deviceUseState } from "./islandState";

const sideSlot = defineSlot<object>("island.side/v1");

function CameraRow() {
  return <DeviceUseIndicator deviceUse={{ ...deviceUseState.use(), microphone: [] }} />;
}

function MicrophoneRow() {
  return <DeviceUseIndicator deviceUse={{ ...deviceUseState.use(), camera: [] }} />;
}

sideSlot.add({ id: "device-camera", order: 70, component: CameraRow });
sideSlot.add({ id: "device-microphone", order: 71, component: MicrophoneRow });
