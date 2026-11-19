import type {
  BatteryReading,
  GpuReading,
  NetworkReading,
  Platform,
  ProgramsReading,
  Reading,
} from "../protocol.ts";

export interface GpuRequest {
  detail: boolean;
}

export interface Source {
  readonly platform: Platform;
  readonly cheapBackground: boolean;
  memoryUsedBytes(): Promise<number | null>;
  cpuTemperature(): Promise<Reading<number>>;
  gpu(request: GpuRequest): Promise<Reading<GpuReading>>;
  network(at: number): Promise<Reading<NetworkReading>>;
  battery(): Promise<Reading<BatteryReading>>;
  programs(at: number): Promise<Reading<ProgramsReading>>;
  programIcons(names: readonly string[]): Promise<Record<string, string | null>>;
  openTaskManager(): Promise<void>;
  resetNetwork(): void;
  resetPrograms(): void;
  dispose(): void;
}

export const UNSUPPORTED = { status: "unsupported" } as const;
export const ABSENT = { status: "absent" } as const;
export const PENDING = { status: "pending" } as const;

export function ok<T>(value: T): Reading<T> {
  return { status: "ok", value };
}

export function failed(error: unknown): { status: "error"; message: string } {
  return { status: "error", message: error instanceof Error ? error.message : String(error) };
}

export function unsupportedSource(platform: Platform): Source {
  return {
    platform,
    cheapBackground: false,
    memoryUsedBytes: async () => null,
    cpuTemperature: async () => UNSUPPORTED,
    gpu: async () => UNSUPPORTED,
    network: async () => UNSUPPORTED,
    battery: async () => UNSUPPORTED,
    programs: async () => UNSUPPORTED,
    programIcons: async () => ({}),
    openTaskManager: async () => {
      throw new Error("not supported on this platform");
    },
    resetNetwork: () => {},
    resetPrograms: () => {},
    dispose: () => {},
  };
}
