import type { PluginAction, PluginNotice as Notice } from "./usePlugins";

export function PluginNotice({ notice, action }: { notice: Notice | null; action: PluginAction | PluginAction[] }) {
  const actions = Array.isArray(action) ? action : [action];
  if (!notice || !actions.includes(notice.action)) return null;
  return (
    <p className="plugin-notice" role="status">
      {notice.text}
    </p>
  );
}
