import { useState } from "react";
import { Wrench } from "lucide-react";
import { useTranslation } from "../../i18n";
import { installAgentHooks } from "./api";

type FixState = "idle" | "working" | "done" | "error";

export function AgentUsageFix({ onFix = defaultFix }: { onFix?: () => Promise<boolean> }) {
  const text = useTranslation().agent.usage;
  const [state, setState] = useState<FixState>("idle");
  const run = async () => {
    setState("working");
    try {
      setState((await onFix()) ? "done" : "error");
    } catch (error) {
      console.error("Failed to reinstall Claude Code hooks", error);
      setState("error");
    }
  };
  if (state === "done" || state === "error") {
    return <span className={`agent-usage-fix__note agent-usage-fix__note--${state}`} role="status">{state === "done" ? text.fixed : text.fixFailed}</span>;
  }
  return (
    <button type="button" className="agent-usage-fix" disabled={state === "working"} onClick={(event) => { event.stopPropagation(); void run(); }}>
      <Wrench size={11} aria-hidden="true" />
      {state === "working" ? text.fixing : text.fix}
    </button>
  );
}

async function defaultFix() {
  const { results } = await installAgentHooks(["claudeCode"]);
  return results.every((result) => !result.error);
}
