import type { BuiltinWidget } from "../../plugin-kernel/widgetCatalog";
import { OWNER } from "./owner.ts";

export const AGENT_SESSIONS_WIDGET: BuiltinWidget = { id: "session-count", owner: OWNER, group: "agents", sizes: ["bar", "m", "l"], order: 40, label: (t) => t.islandWidgets.widgets.agentSessions };

export const islandWidgets: readonly BuiltinWidget[] = [AGENT_SESSIONS_WIDGET];
