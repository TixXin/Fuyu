import { memo } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { IslandHost } from "../../features/plugin-kernel/islandHost";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot } from "../../features/plugin-kernel/slots";
import type { IslandSettings } from "../../lib/settings/types";
import type { openSettingsWindow } from "../settings/api";
import type { takeIslandClickFocus } from "./api";
import type { IslandFeatures } from "./features";
import type { IslandMode, IslandPage } from "./types";
import { usePluginIslandControl } from "./usePluginIslandControl";
import { usePluginPageRequests } from "./usePluginPageRequests";
import { usePluginSpotlightRequests } from "./usePluginSpotlight";
import { useTrayMenuOpenPage } from "./useTrayMenuOpenPage";
import "./slots/builtins";

export type IslandRunnerProps = {
  mode: IslandMode;
  isTucked: boolean;
  quiet: boolean;
  barText: boolean;
  demo: { active: boolean; startedAt: number };
  background: string;
  accent: string | null;
  page: IslandPage;
  settings: IslandSettings;
  setSettings: Dispatch<SetStateAction<IslandSettings>>;
  openSettings: typeof openSettingsWindow;
  takeClickFocus: typeof takeIslandClickFocus;
  host: IslandHost;
  features: IslandFeatures;
  openIslandPage: (page: IslandPage) => void;
  setPage: (page: IslandPage) => void;
  isPeeking: boolean;
  minimizeToEdge: () => void;
  openEnabledPage: (page: IslandPage) => void;
  collapseIsland: () => void;
  tuckIsland: () => void;
  revealIsland: () => void;
};

type BaseRunnerProps = Omit<IslandRunnerProps, "page">;

const runnerSlot = defineSlot<IslandRunnerProps>("island.runner/v1");

const MATCHED_PAGE_RUNNERS: Readonly<Record<string, IslandPage>> = {
  "agent-status.runner": "agents",
  "clipboard.runner": "clipboard",
  "media.runner": "music",
  "messages.runner": "qq",
  "todos.runner": "todo",
  "translation.wiring": "translation",
};

const MATCHED_PAGE_RUNNER_ENTRIES = Object.entries(MATCHED_PAGE_RUNNERS) as [string, IslandPage][];
const LIVE_PAGE_RUNNER_IDS = new Set(["file-shelf.runner"]);

const BackgroundRunners = memo(function BackgroundRunners(props: BaseRunnerProps) {
  return (
    <SlotView
      slot={runnerSlot}
      props={{ ...props, page: "todo" }}
      select={(items) =>
        items.filter(
          (item) => !item.external && !(item.id in MATCHED_PAGE_RUNNERS) && !LIVE_PAGE_RUNNER_IDS.has(item.id),
        )
      }
    />
  );
});

const MatchedPageRunner = memo(function MatchedPageRunner({
  runnerId,
  targetPage,
  active,
  ...base
}: BaseRunnerProps & { runnerId: string; targetPage: IslandPage; active: boolean }) {
  const inactivePage: IslandPage = targetPage === "todo" ? "agents" : "todo";
  return (
    <SlotView
      slot={runnerSlot}
      props={{ ...base, page: active ? targetPage : inactivePage }}
      select={(items) => items.filter((item) => !item.external && item.id === runnerId)}
    />
  );
});

const LivePageRunners = memo(function LivePageRunners(props: IslandRunnerProps) {
  return (
    <SlotView
      slot={runnerSlot}
      props={props}
      select={(items) => items.filter((item) => item.external === true || LIVE_PAGE_RUNNER_IDS.has(item.id))}
    />
  );
});

export const IslandRunners = memo(function IslandRunners({ page, ...base }: IslandRunnerProps) {
  useTrayMenuOpenPage(base.openEnabledPage);
  usePluginPageRequests(base.openEnabledPage);
  usePluginSpotlightRequests();
  usePluginIslandControl({ mode: base.mode, page, openEnabledPage: base.openEnabledPage, collapseIsland: base.collapseIsland });
  return (
    <>
      <BackgroundRunners {...base} />
      {MATCHED_PAGE_RUNNER_ENTRIES.map(([runnerId, targetPage]) => (
        <MatchedPageRunner
          key={runnerId}
          runnerId={runnerId}
          targetPage={targetPage}
          active={page === targetPage}
          {...base}
        />
      ))}
      <LivePageRunners {...base} page={page} />
    </>
  );
});
