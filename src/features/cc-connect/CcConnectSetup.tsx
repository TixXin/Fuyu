import { useState } from "react";
import { SettingsFolderRow } from "../../components/settings/SettingsFolderRow";
import { SettingsFootnote } from "../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsInput } from "../../components/settings/SettingsInput";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useErrorText, useTranslation } from "../../i18n";
import {
  addCcConnectProject,
  allowFromValid,
  CC_CONNECT_AGENT_LABELS,
  CC_CONNECT_SETUP_AGENTS,
  CC_CONNECT_SETUP_PLATFORMS,
  checkCcConnectBot,
  freeProjectName,
  openCcConnectLink,
  type CcConnectBotCheck,
  type CcConnectSetupAgent,
  type CcConnectSetupPlatform,
} from "./api";
import { FeishuSetup } from "./FeishuSetup";
import type { useCcConnect } from "./useCcConnect";
import "./CcConnectSetup.css";

export function CcConnectSetup({ cc }: { cc: ReturnType<typeof useCcConnect> }) {
  const texts = useTranslation().settings.plugins.ccConnect;
  const errorText = useErrorText();
  const t = texts.setup;
  const [platform, setPlatform] = useState<CcConnectSetupPlatform>("telegram");
  const [project, setProject] = useState<string | null>(null);
  const [agent, setAgent] = useState<CcConnectSetupAgent>("claudecode");
  const [workDir, setWorkDir] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [allowFrom, setAllowFrom] = useState("");
  const [bot, setBot] = useState<CcConnectBotCheck | null>(null);
  const [busy, setBusy] = useState<"check" | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [feishu, setFeishu] = useState(false);

  const status = cc.status;
  if (!status) return null;
  const name = project ?? freeProjectName([...status.configProjects, ...status.projects.map((entry) => entry.name)]);
  const folder = workDir ?? status.defaultWorkDir ?? "";
  const ids = allowFrom.split(",").map((id) => id.trim()).filter(Boolean);

  const pick = (next: string) => {
    setPlatform(next as CcConnectSetupPlatform);
    setToken("");
    setAllowFrom("");
    setBot(null);
    setError(null);
    setAdded(false);
  };
  const check = async () => {
    setBusy("check");
    setError(null);
    try {
      const found = await checkCcConnectBot(platform, token);
      setBot(found);
      if (found.senders.length === 1 && !allowFrom) setAllowFrom(found.senders[0].id);
    } catch (reason) {
      setBot(null);
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };
  const add = async () => {
    setBusy("add");
    setError(null);
    try {
      await addCcConnectProject(cc.path, { project: name, agent, workDir: folder, platform, token, allowFrom });
      if (platform === "feishu") {
        setFeishu(true);
      } else {
        setAdded(true);
        setProject(null);
        setToken("");
        setAllowFrom("");
        setBot(null);
      }
      void cc.refresh();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };
  const toggleSender = (id: string) => setAllowFrom((ids.includes(id) ? ids.filter((have) => have !== id) : [...ids, id]).join(","));
  const ready = name.trim() !== "" && folder.trim() !== "" && busy === null;
  const canAdd = ready && token.trim() !== "" && ids.length > 0 && allowFromValid(allowFrom);

  return (
    <SettingsGroup
      title={t.title}
      footer={
        <>
          <SettingsFootnote text={t.hint} />
          {added ? <p role="status">{t.added}</p> : null}
          {error ? <p className="plugin-card__error" role="alert">{error}</p> : null}
        </>
      }
    >
      <SettingsRow
        searchable={false}
        title={t.platform}
        control={
          <SettingsSelect
            value={platform}
            options={CC_CONNECT_SETUP_PLATFORMS.map((value) => ({ value, label: texts.platforms[value] ?? value }))}
            ariaLabel={t.platform}
            disabled={feishu}
            onChange={pick}
          />
        }
      />
      <SettingsRow
        searchable={false}
        title={t.agent}
        description={t.agentHint}
        control={
          <SettingsSelect
            value={agent}
            options={CC_CONNECT_SETUP_AGENTS.map((value) => ({ value, label: CC_CONNECT_AGENT_LABELS[value] }))}
            ariaLabel={t.agent}
            disabled={feishu}
            onChange={(next) => setAgent(next as CcConnectSetupAgent)}
          />
        }
      />
      <SettingsRow searchable={false} title={t.project} description={t.projectHint}>
        <SettingsInput value={name} disabled={feishu} aria-label={t.project} onChange={(event) => setProject(event.currentTarget.value)} />
      </SettingsRow>
      <SettingsFolderRow
        searchable={false}
        title={t.workDir}
        description={t.workDirHint}
        value={folder}
        readOnly={feishu}
        ariaLabel={t.workDir}
        browseTitle={t.workDir}
        onChange={setWorkDir}
        onPick={setWorkDir}
      />
      <SettingsRow searchable={false} title="">
        <ol className="cc-connect-setup__steps">
          {t.steps[platform].map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SettingsRow>
      {platform === "feishu" ? (
        feishu ? (
          <SettingsRow searchable={false} title="">
            <FeishuSetup onEnd={() => setFeishu(false)} />
          </SettingsRow>
        ) : (
          <SettingsRow
            searchable={false}
            title=""
            control={
              <SettingsLinkButton disabled={!ready || !status.exe} onClick={() => void add()}>
                {busy === "add" ? t.adding : t.feishuStart}
              </SettingsLinkButton>
            }
          />
        )
      ) : (
        <>
          <SettingsRow
            searchable={false}
            title={t.token}
            description={bot ? t.bot(bot.name) : undefined}
            control={
              <>
                {bot?.inviteUrl ? (
                  <SettingsLinkButton onClick={() => void openCcConnectLink(bot.inviteUrl ?? "")}>{t.invite}</SettingsLinkButton>
                ) : null}
                <SettingsLinkButton disabled={!token.trim() || busy !== null} onClick={() => void check()}>
                  {busy === "check" ? t.checking : platform === "telegram" ? t.find : t.check}
                </SettingsLinkButton>
              </>
            }
          >
            <SettingsInput
              type="password"
              monospace
              autoComplete="off"
              aria-label={t.token}
              value={token}
              onChange={(event) => {
                setToken(event.currentTarget.value);
                setBot(null);
              }}
            />
          </SettingsRow>
          {platform === "telegram" && bot ? (
            <SettingsRow searchable={false} title={bot.senders.length > 0 ? t.senders : t.noSenders}>
              {bot.senders.length > 0 ? (
                <div className="cc-connect-setup__senders">
                  {bot.senders.map((sender) => (
                    <button
                      key={sender.id}
                      className="settings-button cc-connect-setup__sender"
                      type="button"
                      aria-pressed={ids.includes(sender.id)}
                      onClick={() => toggleSender(sender.id)}
                    >
                      {`${sender.name} · ${sender.id}`}
                    </button>
                  ))}
                </div>
              ) : null}
            </SettingsRow>
          ) : null}
          <SettingsRow
            searchable={false}
            title={t.allowFrom}
            description={allowFrom.trim() && !allowFromValid(allowFrom) ? t.allowFromInvalid : t.allowFromHint}
            control={
              <SettingsLinkButton disabled={!canAdd} onClick={() => void add()}>
                {busy === "add" ? t.adding : t.add}
              </SettingsLinkButton>
            }
          >
            <SettingsInput value={allowFrom} aria-label={t.allowFrom} onChange={(event) => setAllowFrom(event.currentTarget.value)} />
          </SettingsRow>
        </>
      )}
    </SettingsGroup>
  );
}
