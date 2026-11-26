import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsCodeBlock } from "../../components/settings/SettingsCodeBlock";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useFlash } from "../../components/settings/useFlash";
import { useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";

type Shell = "sh" | "powershell" | "node";

const SNIPPETS: Record<Shell, string> = {
  sh: 'FUYU_AGENT_STATUS=off agy -p "…"',
  powershell: '$env:FUYU_AGENT_STATUS = "off"\nagy -p "…"',
  node: 'spawn("agy", ["-p", prompt], {\n  env: { ...process.env, FUYU_AGENT_STATUS: "off" },\n});',
};

export function AgentSilentLaunchSettings() {
  const text = useTranslation().settings.agent.silentLaunch;
  const [shell, setShell] = useState<Shell>(isMacOS ? "sh" : "powershell");
  const [copied, flashCopied] = useFlash<Shell>();
  const copy = () => void navigator.clipboard.writeText(SNIPPETS[shell]).then(() => flashCopied(shell), () => flashCopied(null));

  return (
    <SettingsGroup
      title={text.title}
      action={
        <SettingsChoice<Shell>
          value={shell}
          options={(["sh", "powershell", "node"] as const).map((option) => ({ value: option, label: text.shells[option] }))}
          ariaLabel={text.shellLabel}
          onChange={setShell}
        />
      }
      footer={<SettingsFootnote text={text.hint} />}
    >
      <SettingsCodeBlock
        label={text.shells[shell]}
        code={SNIPPETS[shell]}
        action={
          <SettingsLinkButton onClick={copy}>
            {copied === shell ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />} {copied === shell ? text.copied : text.copy}
          </SettingsLinkButton>
        }
      />
    </SettingsGroup>
  );
}
