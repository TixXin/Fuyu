import type { RecommendedBundle } from "../../lib/onboarding-bundle/recommend.ts";
import type { SystemPermissionKind } from "../../lib/system-permissions/api.ts";
import type { OnboardingModule } from "./personas.ts";

export type OnboardingStepId = "hello" | "shape" | "outfit" | "permissions" | "play" | "release";

export type OnboardingSetupStepId = "agentCards" | "agentConnect" | "push";

export type OnboardingExtensionId = "agentSetup" | "bundle" | "mail";

export type SpotlightMode = "pulse" | "calm" | "off";

export type CardLayoutMode = "compact" | "wide";

export type OnboardingFlowContext = {
  isMacOS: boolean;
  modules: ReadonlySet<OnboardingModule>;
  permissionKinds: readonly SystemPermissionKind[];
  bundle: RecommendedBundle | null;
};

export type OnboardingStepSpec = {
  id: OnboardingStepId;
  layout: CardLayoutMode;
  spotlight: SpotlightMode;
  skippable: boolean;
  when: (ctx: OnboardingFlowContext) => boolean;
};

export type OnboardingSetupStepSpec = {
  id: OnboardingSetupStepId;
  layout: CardLayoutMode;
  spotlight: SpotlightMode;
  skippable: boolean;
  substeps?: number;
  when: (ctx: OnboardingFlowContext) => boolean;
};

export type OnboardingExtensionSpec = {
  id: OnboardingExtensionId;
  kind: "setup" | "settings";
  when: (ctx: OnboardingFlowContext) => boolean;
};

export const STEP_REGISTRY: readonly OnboardingStepSpec[] = [
  { id: "hello", layout: "compact", spotlight: "pulse", skippable: false, when: () => true },
  { id: "shape", layout: "compact", spotlight: "calm", skippable: false, when: () => true },
  { id: "outfit", layout: "compact", spotlight: "calm", skippable: false, when: () => true },
  {
    id: "permissions",
    layout: "compact",
    spotlight: "off",
    skippable: true,
    when: (ctx) => ctx.isMacOS && ctx.permissionKinds.length > 0,
  },
  { id: "play", layout: "compact", spotlight: "pulse", skippable: true, when: () => true },
  { id: "release", layout: "compact", spotlight: "calm", skippable: false, when: () => true },
];

export const AGENT_SETUP_REGISTRY: readonly OnboardingSetupStepSpec[] = [
  { id: "agentCards", layout: "wide", spotlight: "off", skippable: true, when: (ctx) => ctx.modules.has("agents") },
  { id: "agentConnect", layout: "wide", spotlight: "off", skippable: true, when: (ctx) => ctx.modules.has("agents") },
  { id: "push", layout: "wide", spotlight: "off", skippable: true, substeps: 5, when: (ctx) => ctx.modules.has("agents") },
];

export const EXTENSION_REGISTRY: readonly OnboardingExtensionSpec[] = [
  { id: "agentSetup", kind: "setup", when: (ctx) => ctx.modules.has("agents") },
  { id: "bundle", kind: "settings", when: (ctx) => ctx.bundle !== null },
  { id: "mail", kind: "settings", when: (ctx) => ctx.modules.has("mail") },
];

export function resolveMainSteps(ctx: OnboardingFlowContext): OnboardingStepSpec[] {
  return STEP_REGISTRY.filter((step) => step.when(ctx));
}

export function resolveSetupSteps(ctx: OnboardingFlowContext): OnboardingSetupStepSpec[] {
  return AGENT_SETUP_REGISTRY.filter((step) => step.when(ctx));
}

export function resolveExtensions(ctx: OnboardingFlowContext): OnboardingExtensionSpec[] {
  return EXTENSION_REGISTRY.filter((extension) => extension.when(ctx));
}

export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(index, length - 1));
}
