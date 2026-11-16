import { CircleArrowUp } from "lucide-react";
import type { Translations } from "../../../i18n";
import { defineSlot, type IslandCollapsedMeta } from "../../plugin-kernel/slots";

type CollapsedContext = {
  t: Translations;
  updateVersion: string | null;
  onOpenSettings: (section: "updates") => void;
};

const collapsedSlot = defineSlot<CollapsedContext, IslandCollapsedMeta<CollapsedContext>>("island.collapsed/v1");

function UpdateItem({ t, updateVersion, onOpenSettings }: CollapsedContext) {
  return (
    <button
      className="island-message-button island-message-button--compact island-update-badge"
      type="button"
      aria-label={t.settings.project.update.islandReminder(updateVersion ?? "")}
      onClick={(event) => {
        event.stopPropagation();
        onOpenSettings("updates");
      }}
    >
      <CircleArrowUp size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      <span className="island-message-button__dot island-update-badge__dot" aria-hidden="true" />
    </button>
  );
}

collapsedSlot.add({ id: "update", order: 30, shown: ({ updateVersion }) => Boolean(updateVersion), component: UpdateItem });
