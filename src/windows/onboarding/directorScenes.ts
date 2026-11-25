import type { PreviewEvent } from "../../features/agent-status/reminder-settings/previewEvents";
import type { IslandDockEdge } from "../../lib/settings/api";
import type { IslandForm } from "../../lib/settings/types";
import type { IslandPage } from "../island/types";

export const DIRECTOR_SCENE_GROUPS = ["forms", "agents", "panels"] as const;
export type DirectorSceneGroup = (typeof DIRECTOR_SCENE_GROUPS)[number];

export const DIRECTOR_SCENE_IDS = [
  "greet",
  "formPill",
  "formNotch",
  "dockRight",
  "dockLeft",
  "dockBottom",
  "dockTaskbar",
  "tuck",
  "collapse",
  "agentApproval",
  "agentQuestion",
  "agentYourTurn",
  "agentDone",
  "agentFailed",
  "agentStack",
  "dashboard",
  "agents",
  "music",
] as const;

export type DirectorSceneId = (typeof DIRECTOR_SCENE_IDS)[number];

export type DirectorSceneAction =
  | { kind: "notify" }
  | { kind: "form"; form: IslandForm }
  | { kind: "dock"; target: "left" | "right" | "bottom" | "taskbar" }
  | { kind: "tuck" }
  | { kind: "collapse" }
  | { kind: "agentNotice"; event: PreviewEvent }
  | { kind: "expand"; page: IslandPage };

export type DirectorSceneDef = {
  id: DirectorSceneId;
  group: DirectorSceneGroup;
  durationMs: number;
  expanded: boolean | null;
  mutatesAnchor: boolean;
  requiresAgents?: boolean;
  requiresTaskbar?: boolean;
  action: DirectorSceneAction;
};

export type SavedIslandAnchor = {
  islandForm: IslandForm;
  edge: IslandDockEdge;
  taskbarDocked: boolean;
};

export type AnchorRestoreTarget =
  | { kind: "top"; form: IslandForm }
  | { kind: "dock"; target: "left" | "right" | "bottom" | "taskbar" };

export const ALL_DIRECTOR_SCENES: readonly DirectorSceneDef[] = [
  { id: "greet", group: "forms", durationMs: 2500, expanded: false, mutatesAnchor: false, action: { kind: "notify" } },
  { id: "formPill", group: "forms", durationMs: 2200, expanded: false, mutatesAnchor: true, action: { kind: "form", form: "pill" } },
  { id: "formNotch", group: "forms", durationMs: 2200, expanded: false, mutatesAnchor: true, action: { kind: "form", form: "notch" } },
  { id: "dockRight", group: "forms", durationMs: 2300, expanded: false, mutatesAnchor: true, action: { kind: "dock", target: "right" } },
  { id: "dockLeft", group: "forms", durationMs: 2200, expanded: false, mutatesAnchor: true, action: { kind: "dock", target: "left" } },
  { id: "dockBottom", group: "forms", durationMs: 2300, expanded: false, mutatesAnchor: true, action: { kind: "dock", target: "bottom" } },
  { id: "dockTaskbar", group: "forms", durationMs: 2300, expanded: false, mutatesAnchor: true, requiresTaskbar: true, action: { kind: "dock", target: "taskbar" } },
  { id: "tuck", group: "forms", durationMs: 2300, expanded: false, mutatesAnchor: false, action: { kind: "tuck" } },
  { id: "collapse", group: "forms", durationMs: 2000, expanded: false, mutatesAnchor: false, action: { kind: "collapse" } },
  { id: "agentApproval", group: "agents", durationMs: 3200, expanded: null, mutatesAnchor: false, requiresAgents: true, action: { kind: "agentNotice", event: "approval" } },
  { id: "agentQuestion", group: "agents", durationMs: 3000, expanded: null, mutatesAnchor: false, requiresAgents: true, action: { kind: "agentNotice", event: "question" } },
  { id: "agentYourTurn", group: "agents", durationMs: 2700, expanded: null, mutatesAnchor: false, requiresAgents: true, action: { kind: "agentNotice", event: "yourTurn" } },
  { id: "agentDone", group: "agents", durationMs: 2500, expanded: null, mutatesAnchor: false, requiresAgents: true, action: { kind: "agentNotice", event: "done" } },
  { id: "agentFailed", group: "agents", durationMs: 2600, expanded: null, mutatesAnchor: false, requiresAgents: true, action: { kind: "agentNotice", event: "failed" } },
  { id: "agentStack", group: "agents", durationMs: 3000, expanded: null, mutatesAnchor: false, requiresAgents: true, action: { kind: "agentNotice", event: "stack" } },
  { id: "dashboard", group: "panels", durationMs: 2900, expanded: true, mutatesAnchor: false, action: { kind: "expand", page: "fuyu" } },
  { id: "agents", group: "panels", durationMs: 2900, expanded: true, mutatesAnchor: false, requiresAgents: true, action: { kind: "expand", page: "agents" } },
  { id: "music", group: "panels", durationMs: 2800, expanded: true, mutatesAnchor: false, action: { kind: "expand", page: "music" } },
];

export function resolveDirectorScenes({
  agentsEnabled,
  taskbarAvailable,
}: {
  agentsEnabled: boolean;
  taskbarAvailable: boolean;
}): DirectorSceneDef[] {
  return ALL_DIRECTOR_SCENES.filter((scene) => {
    if (scene.requiresAgents && !agentsEnabled) return false;
    if (scene.requiresTaskbar && !taskbarAvailable) return false;
    return true;
  });
}

export function groupDirectorScenes(scenes: readonly DirectorSceneDef[]): { group: DirectorSceneGroup; scenes: DirectorSceneDef[] }[] {
  return DIRECTOR_SCENE_GROUPS.map((group) => ({
    group,
    scenes: scenes.filter((scene) => scene.group === group),
  })).filter((entry) => entry.scenes.length > 0);
}

export function anchorRestoreTarget(anchor: SavedIslandAnchor): AnchorRestoreTarget {
  if (anchor.taskbarDocked && anchor.edge === "bottom") {
    return { kind: "dock", target: "taskbar" };
  }
  if (anchor.edge === "bottom" || anchor.edge === "left" || anchor.edge === "right") {
    return { kind: "dock", target: anchor.edge };
  }
  return { kind: "top", form: anchor.islandForm };
}
