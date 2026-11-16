import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { DeviceUse } from "../api";

export const deviceUseState = createRunnerStore<DeviceUse>({ camera: [], microphone: [] });
