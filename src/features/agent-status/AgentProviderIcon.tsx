import antigravityIcon from "../../assets/brands/antigravity.png";
import claudeCodeIcon from "../../assets/brands/claude-code.png";
import codexIcon from "../../assets/brands/codex.webp";
import workbuddyIcon from "../../assets/brands/workbuddy.svg";
import type { SessionProvider } from "./api";
import "./AgentProviderIcon.css";

const PROVIDER_ICONS: Record<SessionProvider, string> = {
  claudeCode: claudeCodeIcon,
  codex: codexIcon,
  workbuddy: workbuddyIcon,
  antigravity: antigravityIcon,
};

export function AgentProviderIcon({ provider, size = 16 }: { provider: SessionProvider; size?: number }) {
  return (
    <img
      className={`agent-provider-icon agent-provider-icon--${provider}`}
      src={PROVIDER_ICONS[provider]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable={false}
    />
  );
}
