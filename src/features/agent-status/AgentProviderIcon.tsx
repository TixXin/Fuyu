import antigravityIcon from "../../assets/brands/antigravity.png";
import claudeCodeIcon from "../../assets/brands/claude-code.png";
import codebuddyIcon from "../../assets/brands/codebuddy.svg";
import codexIcon from "../../assets/brands/codex.webp";
import copilotIcon from "../../assets/brands/copilot.png";
import droidIcon from "../../assets/brands/droid.png";
import dshIcon from "../../assets/brands/dsh.png";
import kimiCodeIcon from "../../assets/brands/kimi-code.png";
import mimoIcon from "../../assets/brands/mimo.png";
import grokIcon from "../../assets/brands/grok.png";
import opencodeIcon from "../../assets/brands/opencode.png";
import qoderIcon from "../../assets/brands/qoder.png";
import qwenIcon from "../../assets/brands/qwen.png";
import traeIcon from "../../assets/brands/trae.png";
import zcodeIcon from "../../assets/brands/zcode.png";
import workbuddyIcon from "../../assets/brands/workbuddy.svg";
import type { SessionProvider } from "./api";
import "./AgentProviderIcon.css";

const PROVIDER_ICONS: Record<SessionProvider, string> = {
  claudeCode: claudeCodeIcon,
  codex: codexIcon,
  workbuddy: workbuddyIcon,
  antigravity: antigravityIcon,
  dsh: dshIcon,
  opencode: opencodeIcon,
  qoder: qoderIcon,
  codebuddy: codebuddyIcon,
  qwen: qwenIcon,
  trae: traeIcon,
  traeCn: traeIcon,
  zcode: zcodeIcon,
  kimiCode: kimiCodeIcon,
  mimo: mimoIcon,
  grok: grokIcon,
  copilot: copilotIcon,
  droid: droidIcon,
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
