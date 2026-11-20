import type { ReactNode } from "react";
import { ArrowUpRight, Blocks, Check, Layers } from "lucide-react";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { defineSlot, type IslandNoticeMeta } from "../../features/plugin-kernel/slots";
import { useSlotEntries } from "../../features/plugin-kernel/useSlotEntries";
import { useIslandContributed } from "../../features/plugin-kernel/useIslandContributions";
import { useTranslation } from "../../i18n";
import { openSettingsWindow } from "../settings/api";
import { FirstHintActions, FirstHintNotice } from "./first-hints/FirstHintNotice";
import type { FirstHintsController } from "./first-hints/useFirstHints";
import type { IslandLayerNoticeController } from "./useIslandLayerNotice";
import type { V2UpgradeNoticeController } from "./useV2UpgradeNotice";
import "./slots/builtins";

export type IslandNotice = { content: ReactNode; actions: ReactNode };

type NoticeSources = {
  firstHints: FirstHintsController;
  v2Upgrade?: V2UpgradeNoticeController;
  layer?: IslandLayerNoticeController;
};

const noticeSlot = defineSlot<NoticeSources, IslandNoticeMeta<NoticeSources>>("island.notice/v1");

function LayerContent({ layer }: NoticeSources) {
  if (!layer?.text) return null;
  return (
    <span className="first-hint" role="status">
      <Layers className="first-hint__icon" size={14} strokeWidth={2} aria-hidden="true" />
      <span className="first-hint__text">{layer.text}</span>
    </span>
  );
}

function NoButtons() {
  return null;
}

function V2UpgradeContent({ v2Upgrade }: NoticeSources) {
  if (!v2Upgrade?.text) return null;
  return (
    <span className="first-hint" role="status" onPointerEnter={v2Upgrade.hold} onPointerLeave={v2Upgrade.release}>
      <Blocks className="first-hint__icon" size={14} strokeWidth={2} aria-hidden="true" />
      <span className="first-hint__text">{v2Upgrade.text}</span>
    </span>
  );
}

function V2UpgradeButtons({ v2Upgrade }: NoticeSources) {
  const copy = useTranslation().island.v2Migration;
  if (!v2Upgrade?.active) return null;
  const stop = (run: () => void) => (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    run();
  };
  return (
    <span className="first-hint__actions" onPointerEnter={v2Upgrade.hold} onPointerLeave={v2Upgrade.release}>
      <button
        className="first-hint__action"
        type="button"
        aria-label={copy.viewGuide}
        title={copy.viewGuide}
        onClick={stop(() => {
          v2Upgrade.acknowledge();
          openSettingsWindow("pluginsV3");
        })}
      >
        <ArrowUpRight size={13} strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        className="first-hint__action"
        type="button"
        aria-label={copy.gotIt}
        title={copy.gotIt}
        onClick={stop(v2Upgrade.acknowledge)}
      >
        <Check size={13} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}

function FirstHintContent({ firstHints }: NoticeSources) {
  return <FirstHintNotice key={firstHints.current} hints={firstHints} />;
}

function FirstHintButtons({ firstHints }: NoticeSources) {
  return <FirstHintActions hints={firstHints} onConnectTools={() => openSettingsWindow("agentConnect")} />;
}

noticeSlot.add({ id: "island-layer", order: 60, active: ({ layer }) => Boolean(layer?.active), component: LayerContent, actions: NoButtons });
noticeSlot.add({ id: "v2-plugin-migration", order: 65, active: ({ v2Upgrade }) => Boolean(v2Upgrade?.active), component: V2UpgradeContent, actions: V2UpgradeButtons });
noticeSlot.add({ id: "first-hints", order: 70, active: ({ firstHints }) => Boolean(firstHints.current), component: FirstHintContent, actions: FirstHintButtons });

export function useIslandNotice(sources: NoticeSources): IslandNotice | null {
  const entries = useSlotEntries(noticeSlot);
  const { notices } = useIslandContributed();
  const entry = entries.find((item) => notices.has(item.id) || item.active?.(sources));
  if (!entry) return null;
  return {
    content: <SlotView slot={noticeSlot} props={sources} select={() => [entry]} />,
    actions: <SlotView slot={noticeSlot} props={sources} select={() => [{ ...entry, component: entry.actions }]} />,
  };
}
