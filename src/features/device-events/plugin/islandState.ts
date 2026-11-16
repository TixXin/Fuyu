import { createRunnerStore } from "../../plugin-kernel/runnerStore";
import type { DeviceAlert } from "../api";

export const deviceAlertState = createRunnerStore<DeviceAlert | null>(null);
