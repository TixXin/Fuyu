import { useEffect, useRef, useState } from "react";
import { Check, Play } from "lucide-react";
import { commandsV1, type CommandItem } from "@fuyu/plugin-services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";
import { windowServices } from "../../features/plugin-kernel/services";
import { shortcutLabel } from "../../lib/shortcut/shortcut";

const commandsClient = windowServices.get(commandsV1);

export type RunBlock = "offline" | "off" | "notRunning";

type RunState = { kind: "idle" } | { kind: "running" } | { kind: "done" } | { kind: "failed"; message: string };

const notHandled = (failure: unknown) => typeof failure === "object" && failure !== null && (failure as { code?: unknown }).code === "not-running";

function pick(map: Record<string, string> | null | undefined, locale: string, fallback: string): string {
  if (!map) return fallback;
  return (locale === "en" ? map.en : map["zh-CN"]) ?? map["zh-CN"] ?? map.en ?? fallback;
}

export function PluginCommandRow({ item, block, onOpenShortcuts }: { item: CommandItem; block: RunBlock | null; onOpenShortcuts?: () => void }) {
  const text = useTranslation().settings.pluginsV3.page.detail;
  const { locale } = useLocale();
  const errorText = useErrorText();
  const [state, setState] = useState<RunState>({ kind: "idle" });
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (state.kind !== "done") return;
    const timer = window.setTimeout(() => setState({ kind: "idle" }), 1600);
    return () => window.clearTimeout(timer);
  }, [state.kind]);

  const blocked = block ?? (item.active ? null : "off");
  const conflict = Boolean(item.keybinding) && item.conflicts.length > 0;
  const run = () => {
    setState({ kind: "running" });
    void commandsClient
      .run({ plugin: item.pluginId, command: item.id })
      .then(() => live.current && setState({ kind: "done" }))
      .catch((failure: unknown) => live.current && setState({ kind: "failed", message: notHandled(failure) ? text.runNotHandled : errorText(failure) }));
  };

  return (
    <div className="plugin-detail__row" data-command={item.id} data-run-state={state.kind}>
      <span className="plugin-detail__row-title">{pick(item.title, locale, item.id)}</span>
      <span className="plugin-detail__row-sub">
        {item.id}
        {conflict ? <span className="plugin-detail__conflict"> · {text.conflict}</span> : null}
      </span>
      <span className="plugin-detail__row-control">
        {item.keybinding ? <kbd className={conflict ? "plugin-kbd plugin-kbd--warn" : "plugin-kbd"}>{shortcutLabel(item.keybinding)}</kbd> : <span className="plugin-detail__muted">{text.noShortcut}</span>}
        {onOpenShortcuts ? <button className="plugin-btn plugin-btn--sm" type="button" onClick={onOpenShortcuts}>{item.keybinding ? text.change : text.set}</button> : null}
        <button
          className="plugin-btn plugin-btn--sm"
          type="button"
          data-action="run-command"
          disabled={blocked !== null || state.kind === "running"}
          aria-busy={state.kind === "running"}
          title={blocked ? text.runBlocked[blocked] : undefined}
          onClick={run}
        >
          {state.kind === "done" ? <Check size={13} strokeWidth={2.4} aria-hidden="true" /> : <Play size={12} strokeWidth={2.4} aria-hidden="true" />}
          {state.kind === "running" ? text.running : state.kind === "done" ? text.ran : text.run}
        </button>
      </span>
      {state.kind === "failed" ? <span className="plugin-detail__row-error" role="alert" data-run-error>{text.runFailed(state.message)}</span> : null}
    </div>
  );
}
