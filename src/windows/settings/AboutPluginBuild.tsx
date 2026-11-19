import { useState } from "react";
import { BookOpen, Check, Copy, GitFork, GraduationCap, ShieldAlert } from "lucide-react";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { useFlash } from "../../components/settings/useFlash";
import { useOpenInBrowser } from "../../features/updater/useOpenInBrowser";
import { useTranslation } from "../../i18n";
import { PLUGIN_DOCS_URL } from "./pluginMarketActions";

const TUTORIAL_URL = "https://github.com/TixXin/fuyu/blob/main/docs/plugins/first-plugin.md";
const BASE_REPO_URL = "https://github.com/TixXin/tauri-cordis";
const CREATE_COMMAND = "npm create fuyu-plugin@latest";
const IDEA_MAX = 600;

export function AboutPluginBuild() {
  const text = useTranslation().settings;
  const build = text.aboutPlugins.build;
  const [idea, setIdea] = useState("");
  const [copied, flashCopied] = useFlash<"copied" | "failed">();
  const { failed, onClick } = useOpenInBrowser();
  const prompt = build.prompt(idea.trim() || build.ideaFallback);
  const copy = () => void navigator.clipboard.writeText(prompt).then(() => flashCopied("copied"), () => flashCopied("failed"));
  const links = [
    { href: TUTORIAL_URL, label: build.tutorial, Icon: GraduationCap, hint: undefined },
    { href: PLUGIN_DOCS_URL, label: build.docs, Icon: BookOpen, hint: undefined },
    { href: BASE_REPO_URL, label: build.base, Icon: GitFork, hint: build.baseHint },
  ];

  return (
    <SettingsGroup title={text.aboutPlugins.buildTitle}>
      <div className="about-plugins__build" data-build="ai">
        <strong>{build.aiTitle}</strong>
        <p>{build.aiBody}</p>
        <textarea
          className="about-plugins__idea"
          rows={2}
          maxLength={IDEA_MAX}
          spellCheck={false}
          aria-label={build.ideaLabel}
          placeholder={build.ideaPlaceholder}
          value={idea}
          onChange={(event) => setIdea(event.target.value)}
        />
        <div className="about-plugins__prompt-bar">
          <details className="about-plugins__prompt">
            <summary>{build.showPrompt}</summary>
            <pre>{prompt}</pre>
          </details>
          <span className="about-plugins__copy" data-copied={copied === "copied" ? "" : undefined}>
            <SettingsLinkButton onClick={copy}>
              {copied === "copied" ? <Check size={12} strokeWidth={2.6} aria-hidden="true" /> : <Copy size={12} strokeWidth={2.4} aria-hidden="true" />}{" "}
              {copied === "copied" ? build.copied : build.copy}
            </SettingsLinkButton>
          </span>
        </div>
        {copied === "failed" ? <p className="project-link-error" role="alert">{build.copyFailed}</p> : null}
        <p className="about-plugins__caution">
          <ShieldAlert size={13} strokeWidth={2} aria-hidden="true" />
          <span>{build.caution}</span>
        </p>
      </div>
      <div className="about-plugins__build" data-build="manual">
        <strong>{build.manualTitle}</strong>
        <p>{build.body}</p>
        <code className="about-plugins__command" aria-label={build.commandLabel}>{CREATE_COMMAND}</code>
        <nav className="about-plugins__links" aria-label={build.linksLabel}>
          {links.map(({ href, label, Icon, hint }) => (
            <a key={href} className="about-plugins__action" href={href} title={hint} target="_blank" rel="noopener noreferrer" onClick={onClick}>
              <Icon size={13} strokeWidth={1.9} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
        {failed ? <p className="project-link-error" role="alert">{text.project.openFailed}</p> : null}
      </div>
    </SettingsGroup>
  );
}
