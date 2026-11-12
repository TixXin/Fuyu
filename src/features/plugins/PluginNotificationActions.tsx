import type { PluginNotification } from "./api";
import "./PluginNotificationActions.css";

export function PluginNotificationActions({
  actions,
  onAction,
}: {
  actions: PluginNotification["actions"];
  onAction: (id: string) => void;
}) {
  return (
    <>
      {actions.map((action) => (
        <button
          className="plugin-notification-action"
          type="button"
          key={action.id}
          onClick={(event) => {
            event.stopPropagation();
            onAction(action.id);
          }}
        >
          {action.title}
        </button>
      ))}
    </>
  );
}
