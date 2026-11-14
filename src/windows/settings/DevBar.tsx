import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { useTranslation } from "../../i18n";
import { isMacOS, useDevBuild } from "../../lib/platform";
import type { DevPriorityState } from "./api";
import { useDevPriority } from "./useDevPriority";
import "./DevBar.css";

function statusOf(state: DevPriorityState): "alone" | "yielding" | "both" {
  if (!state.releaseRunning) return "alone";
  return state.yielding ? "yielding" : "both";
}

export function DevBar() {
  const text = useTranslation().settings.devBuild;
  const devBuild = useDevBuild();
  const [state, choose] = useDevPriority(devBuild && !isMacOS);
  if (!devBuild) return null;
  return (
    <div className="dev-bar">
      <span className="dev-bar__mark" aria-hidden="true">{text.mark}</span>
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
