import { Coffee } from "lucide-react";
import { useTranslation } from "../../i18n";
import { AgentBlock } from "./AgentBlock";
import { columns, shownFeatures } from "./builtinEntries";
import { FeatureButton } from "./FeatureButton";
import { IslandButton } from "./IslandButton";
import { MediaBlock } from "./MediaBlock";
import { MeetingBlock } from "./MeetingBlock";
import { TrayCardFooter } from "./TrayCardFooter";
import { TrayCardHeader } from "./TrayCardHeader";
import { TraySwitch } from "./TraySwitch";
import type { TrayCardProps } from "./types";

export function StatusLayout(props: TrayCardProps) {
  const text = useTranslation().trayMenu;
  const { data, handlers } = props;
  const features = shownFeatures(data.off, ["screenshot", "translate"]);
  const calm = !data.media && !data.meeting && !data.agents;
  return (
    <>
      <TrayCardHeader {...props} />
      {data.media ? <MediaBlock media={data.media} handlers={handlers} /> : null}
      {data.meeting ? <MeetingBlock meeting={data.meeting} now={data.now} handlers={handlers} /> : null}
      {data.agents ? <AgentBlock agents={data.agents} handlers={handlers} /> : null}
      {calm ? (
        <div className="tray-card__block">
          <span className="tray-card__block-icon" aria-hidden="true">
            <Coffee size={16} />
          </span>
          <span className="tray-card__block-text tray-card__block-text--wrap">
            <b>{text.calm}</b>
            <span>{text.calmSub}</span>
          </span>
        </div>
      ) : null}
      <div className="tray-card__pills" style={columns(features.length + 1)}>
        <IslandButton variant="pill" {...props} />
        {features.map((feature) => <FeatureButton key={feature} feature={feature} variant="pill" showShortcut={false} {...props} />)}
      </div>
      <TrayCardFooter handlers={handlers} lead={<TraySwitch label={text.dnd} checked={data.dnd} onToggle={handlers.onDnd} />} />
    </>
  );
}
