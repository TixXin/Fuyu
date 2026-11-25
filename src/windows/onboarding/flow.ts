import type { RecommendedBundle } from "../../lib/onboarding-bundle/recommend.ts";
import type { SystemPermissionKind } from "../../lib/system-permissions/api.ts";
import type { OnboardingModule } from "./personas.ts";

export type OnboardingStepId = "hello" | "shape" | "outfit" | "permissions" | "play" | "release";

export type OnboardingWhatsNewStepId = "whatsNewNotes" | "whatsNewForms";

export type OnboardingSetupStepId = "agentCards" | "agentConnect" | "push";

export type OnboardingExtensionId = "agentSetup" | "bundle" | "mail";

export type OnboardingTrack = "firstRun" | "whatsNew" | "setup";

export type SpotlightMode = "pulse" | "calm" | "off";

export type CardLayoutMode = "compact" | "wide" | "stage";

export type OnboardingFlowContext = {
  isMacOS: boolean;
  modules: ReadonlySet<OnboardingModule>;
  permissionKinds: readonly SystemPermissionKind[];
  bundle: RecommendedBundle | null;
};

export type OnboardingStepSpec<Id extends string = OnboardingStepId> = {
  id: Id;
  layout: CardLayoutMode;
  spotlight: SpotlightMode;
  skippable: boolean;
  autoDirector?: boolean;
  substeps?: number;
  when: (ctx: OnboardingFlowContext) => boolean;
};

export type OnboardingSetupStepSpec = OnboardingStepSpec<OnboardingSetupStepId>;

export type OnboardingWhatsNewStepSpec = OnboardingStepSpec<OnboardingWhatsNewStepId>;

export type OnboardingExtensionSpec = {
  id: OnboardingExtensionId;
  kind: "setup" | "settings";
  when: (ctx: OnboardingFlowContext) => boolean;
};

export const STEP_REGISTRY: readonly OnboardingStepSpec[] = [
  { id: "hello", layout: "stage", spotlight: "pulse", skippable: false, autoDirector: true, when: () => true },
  { id: "shape", layout: "stage", spotlight: "calm", skippable: false, when: () => true },
  { id: "outfit", layout: "stage", spotlight: "calm", skippable: false, when: () => true },
  {
    id: "permissions",
    layout: "wide",
    spotlight: "off",
    skippable: true,
    when: (ctx) => ctx.isMacOS && ctx.permissionKinds.length > 0,
  },
  { id: "play", layout: "wide", spotlight: "pulse", skippable: true, when: () => true },
  { id: "release", layout: "stage", spotlight: "calm", skippable: false, when: () => true },
];

export const WHATS_NEW_REGISTRY: readonly OnboardingWhatsNewStepSpec[] = [
  { id: "whatsNewNotes", layout: "stage", spotlight: "calm", skippable: false, when: () => true },
  { id: "whatsNewForms", layout: "stage", spotlight: "pulse", skippable: true, when: () => true },
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

export function resolveWhatsNewSteps(ctx: OnboardingFlowContext): OnboardingWhatsNewStepSpec[] {
  return WHATS_NEW_REGISTRY.filter((step) => step.when(ctx));
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
