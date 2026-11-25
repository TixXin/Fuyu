import { RotateCcw } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { useTranslation } from "../../i18n";
import { isMacOS, useDevBuild } from "../../lib/platform";
import type { DevPriorityState } from "./api";
import { useDevPriority } from "./useDevPriority";
import "./DevBar.css";

function statusOf(state: DevPriorityState): "alone" | "yielding" | "releaseYields" | "both" {
  if (!state.releaseRunning) return "alone";
  if (state.yielding) return "yielding";
  return state.releaseYields ? "releaseYields" : "both";
}

export function DevBar({ onReplayWhatsNew }: { onReplayWhatsNew?: () => void } = {}) {
  const text = useTranslation().settings.devBuild;
  const devBuild = useDevBuild();
  const [state, choose] = useDevPriority(devBuild && !isMacOS);
  if (!devBuild) return null;
  return (
    <div className="dev-bar">
      <span className="dev-bar__mark" aria-hidden="true">{text.mark}</span>
      {onReplayWhatsNew && (
        <button
          className="dev-bar__action"
          type="button"
          title={text.replayWhatsNewHint}
          onClick={onReplayWhatsNew}
        >
          <RotateCcw size={11} strokeWidth={2.2} aria-hidden="true" />
          <span>{text.replayWhatsNew}</span>
        </button>
      )}
      {state && (
        <>
          <SettingsChoice
            value={state.priority}
            options={[
              { value: "releaseFirst", label: text.releaseFirst },
              { value: "devFirst", label: text.devFirst },
            ]}
            ariaLabel={text.priorityLabel}
            onChange={choose}
          />
          <span className="dev-bar__status" role="status">{text.status[statusOf(state)]}</span>
        </>
      )}
    </div>
  );
}
