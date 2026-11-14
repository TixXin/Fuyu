import { useLocale, useTranslation } from "../../i18n";
import { isMacOS } from "../../lib/platform";
import type { PluginInfo } from "./api";
import { memorySplit } from "./runStats.ts";
import { runtimeProblem } from "./runtimeProblem";
import "./PluginCardNotes.css";

type Tone = "error" | "warn" | "info";

export function PluginCardNotes({ plugin, allowed, nodeAvailable, powershellAvailable }: {
  plugin: PluginInfo;
  allowed: boolean;
  nodeAvailable: boolean;
  powershellAvailable: boolean;
}) {
  const t = useTranslation();
  const { locale } = useLocale();
  const text = t.settings.plugins;
  const isOn = plugin.enabled && !plugin.needsApproval;
  const canRun = allowed || plugin.builtin || plugin.dev;
  const running = plugin.hasProcess && canRun && isOn;
  const split = running && plugin.resources ? memorySplit(plugin.resources) : null;
  const problem = runtimeProblem(isMacOS ? "macos" : "windows", plugin.runtime, plugin.platforms, nodeAvailable, powershellAvailable);
  const updateOffered = plugin.updateAvailable && plugin.updateAvailable !== plugin.autoUpdated ? plugin.updateAvailable : null;

  const facts = [
    split ? text.run.memory(split.runtime ? split.runtime.plugin : split.total) : null,
    running && plugin.activation === "onDemand" ? text.run.onDemandShort : null,
    running && plugin.keepAlive ? text.run.keepAliveShort : null,
    plugin.hasProcess ? null : text.describedOnlyShort,
    plugin.autoUpdated ? text.updates.autoUpdatedShort(plugin.autoUpdated) : null,
    plugin.preReleaseAvailable && !plugin.preRelease ? text.updates.preReleaseShort(plugin.preReleaseAvailable) : null,
  ].filter((fact): fact is string => fact !== null);

  const alerts: { tone: Tone; text: string }[] = [];
  const add = (tone: Tone, message: string | null | false | undefined) => {
    if (message) alerts.push({ tone, text: message });
  };
  add("error", plugin.revoked && text.updates.revoked(plugin.revoked[locale]));
  add("error", plugin.updateFailed && text.updates.autoUpdateFailed(plugin.updateFailed));
  add("error", running && plugin.error);
  add("error", running && plugin.resources?.highCpu && text.run.highCpu);
  add("warn", plugin.needsApproval && text.needsApproval);
  add("warn", isOn && !canRun && text.notAllowed);
  add("warn", problem === "platform" && (isMacOS ? text.notForMac : text.notForWindows));
  add("warn", problem === "node" && text.needsNode);
  add("warn", problem === "powershell" && text.needsPowershell);
  add("warn", updateOffered && plugin.signingKeyChanged && text.updates.keyChanged(updateOffered));
  add("warn", plugin.keybindingConflicts.length > 0 && text.keybindingConflict(plugin.keybindingConflicts.join(", ")));
  add("info", updateOffered && !plugin.signingKeyChanged && text.updates.available(updateOffered));
  const first = alerts[0];

  return (
    <>
      {facts.length > 0 ? <p className="plugin-card__facts">{facts.join(" · ")}</p> : null}
      {first ? (
        <p className={`plugin-card__alert plugin-card__alert--${first.tone}`}>
          <span className="plugin-card__alert-text">{first.text}</span>
          {alerts.length > 1 ? <span className="plugin-card__alert-more">{text.moreNotes(alerts.length - 1)}</span> : null}
        </p>
      ) : null}
    </>
  );
}
