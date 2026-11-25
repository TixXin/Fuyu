import { requestAgentTestNotice } from "../../features/agent-status/api";
import type { PreviewSamples } from "../../features/agent-status/reminder-settings/previewSamples";
import { testNoticeRequest } from "../../features/agent-status/testNotice";
import { dockIslandTo, type IslandDockEdge } from "../../lib/settings/api";
import { loadIslandPages, saveIslandPages, type IslandPagesLayout } from "../../lib/settings/islandPages";
import { applySideDockSplitPreset, loadSideDocks, saveSideDocks, type SideDocksSettings } from "../../lib/settings/sideDocks";
import type { IslandForm } from "../../lib/settings/types";
import { requestIslandPositionReset } from "../settings/storage";
import { previewSideDock } from "../side-dock/api";
import { anchorRestoreTarget, type DirectorSceneDef, type SavedIslandAnchor } from "./directorScenes";
import { sendIslandDirectorCommand } from "./storage";

export type LastDispatchedKind = "collapsed" | "expanded" | "tucked" | "docked" | "agentNotice" | "sideDock";

export type DirectorDispatchEnv = {
  islandForm: IslandForm;
  edge: IslandDockEdge | null;
  taskbarDocked: boolean;
  onSetIslandForm: (form: IslandForm) => void;
  notifyTitle: string;
  notifyBody: string;
  agentSamples: PreviewSamples;
};

export type SavedSideDocksSnapshot = {
  sideDocks: SideDocksSettings;
  layout: IslandPagesLayout;
};

export type DirectorDispatchState = {
  prepTimer: number;
  expectedExpanded: boolean | null;
  lastCommandAt: number;
  lastKind: LastDispatchedKind;
  virtualDocked: boolean;
  savedAnchor: SavedIslandAnchor | null;
  savedSideDocks: SavedSideDocksSnapshot | null;
  wingsPreviewOpen: boolean;
  noticeSeq: number;
};

const SETTLE_TOP_MS = 320;
const AGENT_NOTICE_PREP_MS = 380;
const AGENT_PAGE_PREP_MS = 260;
const SIDE_DOCK_PREP_MS = 420;

export function closeSideDockPreviews(state: DirectorDispatchState) {
  if (!state.wingsPreviewOpen) return;
  state.wingsPreviewOpen = false;
  void previewSideDock("left", false).catch(() => undefined);
  void previewSideDock("right", false).catch(() => undefined);
}

export function ensureIslandAtTop(
  state: DirectorDispatchState,
  env: DirectorDispatchEnv,
  targetForm?: IslandForm,
): boolean {
  const isDocked =
    state.virtualDocked ||
    (env.edge !== null && env.edge !== "top") ||
    env.taskbarDocked;
  if (isDocked) {
    requestIslandPositionReset();
    state.virtualDocked = false;
  }
  if (targetForm && env.islandForm !== targetForm) {
    env.onSetIslandForm(targetForm);
  }
  return isDocked;
}

export function restoreSavedAnchor(
  state: DirectorDispatchState,
  env: DirectorDispatchEnv,
  clearOnly: boolean,
): boolean {
  closeSideDockPreviews(state);
  let hadSaved = false;
  const sideSnapshot = state.savedSideDocks;
  if (sideSnapshot) {
    hadSaved = true;
    state.savedSideDocks = null;
    if (!clearOnly) {
      saveIslandPages(sideSnapshot.layout);
      saveSideDocks(sideSnapshot.sideDocks);
    }
  }
  const anchor = state.savedAnchor;
  if (!anchor) return hadSaved;
  hadSaved = true;
  state.savedAnchor = null;
  if (clearOnly) return true;
  const target = anchorRestoreTarget(anchor);
  if (target.kind === "top") {
    ensureIslandAtTop(state, env, target.form);
    return true;
  }
  state.virtualDocked = true;
  void dockIslandTo(target.target).catch((error: unknown) => console.error("Failed to restore island dock edge", error));
  if (env.islandForm !== anchor.islandForm) {
    env.onSetIslandForm(anchor.islandForm);
  }
  return true;
}

function ensureSideDockSplitActive(state: DirectorDispatchState, onCaptured: () => void): boolean {
  const currentSideDocks = loadSideDocks();
  const alreadyBoth = currentSideDocks.left.enabled && currentSideDocks.right.enabled;
  if (!state.savedSideDocks) {
    state.savedSideDocks = {
      sideDocks: currentSideDocks,
      layout: loadIslandPages(),
    };
    onCaptured();
  }
  if (alreadyBoth) return false;
  const applied = applySideDockSplitPreset(currentSideDocks, loadIslandPages());
  saveIslandPages(applied.layout);
  saveSideDocks(applied.settings);
  return true;
}

export function runDirectorScene(
  scene: DirectorSceneDef,
  state: DirectorDispatchState,
  getEnv: () => DirectorDispatchEnv,
  onAnchorCaptured: () => void,
  options?: { skipNotify?: boolean },
) {
  window.clearTimeout(state.prepTimer);
  state.prepTimer = 0;
  const env = getEnv();
  if (scene.mutatesAnchor && !state.savedAnchor) {
    state.savedAnchor = {
      islandForm: env.islandForm,
      edge: env.edge ?? "top",
      taskbarDocked: env.taskbarDocked,
    };
    onAnchorCaptured();
  }

  const topForm = state.savedAnchor?.islandForm;
  const action = scene.action;
  if (action.kind !== "sideSplit" && action.kind !== "sideWing") {
    closeSideDockPreviews(state);
  }

  if (action.kind === "notify") {
    const wasDocked = ensureIslandAtTop(state, env, topForm);
    const fire = () => {
      const cur = getEnv();
      state.expectedExpanded = false;
      state.lastCommandAt = Date.now();
      state.lastKind = "collapsed";
      if (!options?.skipNotify) {
        sendIslandDirectorCommand({ action: "notify", title: cur.notifyTitle, body: cur.notifyBody });
      }
    };
    if (wasDocked) {
      state.expectedExpanded = null;
      state.prepTimer = window.setTimeout(fire, SETTLE_TOP_MS);
    } else {
      fire();
    }
    return;
  }

  if (action.kind === "form") {
    if (state.lastKind === "expanded" || state.lastKind === "agentNotice" || state.lastKind === "tucked") {
      sendIslandDirectorCommand({ action: "collapse" });
    }
    ensureIslandAtTop(state, env, action.form);
    state.expectedExpanded = false;
    state.lastCommandAt = Date.now();
    state.lastKind = "collapsed";
    return;
  }

  if (action.kind === "dock") {
    if (state.lastKind === "expanded" || state.lastKind === "agentNotice" || state.lastKind === "tucked") {
      sendIslandDirectorCommand({ action: "collapse" });
    }
    state.virtualDocked = true;
    state.expectedExpanded = false;
    state.lastCommandAt = Date.now();
    state.lastKind = "docked";
    void dockIslandTo(action.target).catch((error: unknown) => console.error("Failed to dock the island", error));
    return;
  }

  if (action.kind === "tuck") {
    const wasDocked = ensureIslandAtTop(state, env, topForm);
    const fire = () => {
      state.expectedExpanded = false;
      state.lastCommandAt = Date.now();
      state.lastKind = "tucked";
      sendIslandDirectorCommand({ action: "tuck" });
    };
    if (wasDocked) {
      state.expectedExpanded = null;
      state.prepTimer = window.setTimeout(fire, SETTLE_TOP_MS);
    } else {
      fire();
    }
    return;
  }

  if (action.kind === "collapse") {
    ensureIslandAtTop(state, env, topForm);
    state.expectedExpanded = false;
    state.lastCommandAt = Date.now();
    state.lastKind = "collapsed";
    sendIslandDirectorCommand({ action: "collapse" });
    return;
  }

  if (action.kind === "sideSplit") {
    const wasDocked = ensureIslandAtTop(state, env, topForm);
    const spawned = ensureSideDockSplitActive(state, onAnchorCaptured);
    state.expectedExpanded = null;
    state.lastCommandAt = Date.now();
    state.lastKind = "sideDock";
    sendIslandDirectorCommand({ action: "expand", page: "fuyu" });
    const openWings = () => {
      state.wingsPreviewOpen = true;
      void previewSideDock("left", true).catch(() => undefined);
      void previewSideDock("right", true).catch(() => undefined);
    };
    if (spawned || wasDocked) {
      state.prepTimer = window.setTimeout(openWings, SIDE_DOCK_PREP_MS);
    } else {
      openWings();
    }
    return;
  }

  if (action.kind === "sideWing") {
    const wasDocked = ensureIslandAtTop(state, env, topForm);
    const spawned = ensureSideDockSplitActive(state, onAnchorCaptured);
    const other = action.edge === "left" ? "right" : "left";
    state.expectedExpanded = false;
    state.lastCommandAt = Date.now();
    state.lastKind = "sideDock";
    sendIslandDirectorCommand({ action: "collapse" });
    const showWing = () => {
      state.wingsPreviewOpen = true;
      void previewSideDock(other, false).catch(() => undefined);
      void previewSideDock(action.edge, true).catch(() => undefined);
    };
    if (spawned || wasDocked) {
      state.prepTimer = window.setTimeout(showWing, SIDE_DOCK_PREP_MS);
    } else {
      showWing();
    }
    return;
  }

  if (action.kind === "agentNotice") {
    const wasDocked = ensureIslandAtTop(state, env, topForm);
    const needsPrep = wasDocked || state.lastKind === "expanded" || state.lastKind === "tucked" || state.lastKind === "sideDock";
    const fire = () => {
      state.noticeSeq += 1;
      state.expectedExpanded = null;
      state.lastCommandAt = Date.now();
      state.lastKind = "agentNotice";
      const req = testNoticeRequest(action.event, getEnv().agentSamples, state.noticeSeq);
      void requestAgentTestNotice(req).catch((error: unknown) => console.error("Failed to trigger agent demo notice", error));
    };
    if (needsPrep) {
      state.expectedExpanded = null;
      sendIslandDirectorCommand({ action: "collapse" });
      state.prepTimer = window.setTimeout(fire, AGENT_NOTICE_PREP_MS);
    } else {
      fire();
    }
    return;
  }

  const wasDocked = ensureIslandAtTop(state, env, topForm);
  const needsResetAgents = action.page === "agents" && state.lastKind === "agentNotice";
  const fire = () => {
    state.expectedExpanded = true;
    state.lastCommandAt = Date.now();
    state.lastKind = "expanded";
    sendIslandDirectorCommand({ action: "expand", page: action.page });
  };
  if (wasDocked || needsResetAgents) {
    state.expectedExpanded = null;
    if (needsResetAgents) sendIslandDirectorCommand({ action: "collapse" });
    state.prepTimer = window.setTimeout(fire, wasDocked ? SETTLE_TOP_MS : AGENT_PAGE_PREP_MS);
  } else {
    fire();
  }
}
