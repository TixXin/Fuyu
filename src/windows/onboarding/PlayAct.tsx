import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { ExpandTrigger, IslandSettings } from "../../features/appearance/types";
import { listenClipboardPopupOpened, type ClipboardHistorySettings } from "../../features/clipboard/api";
import { getFileShelf } from "../../features/file-shelf/api";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import type { OnboardingModule } from "./personas";
import "./PlayAct.css";

const SHELF_POLL_MS = 800;

type Task = "expand" | "drop" | "shortcut";

function useShelfGrew(watch: boolean, onGrow: () => void) {
  useEffect(() => {
    if (!watch) return;
    let start: number | null = null;
    let stopped = false;
    const read = () =>
      void getFileShelf()
        .then(({ items }) => {
          if (stopped) return;
          if (start === null) start = items.length;
          else if (items.length > start) onGrow();
        })
        .catch(() => undefined);
    read();
    const timer = window.setInterval(read, SHELF_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [watch, onGrow]);
}

export function PlayAct({ settings, modules, clipboard, islandOpen, onSettingsChange, onClipboardChange }: {
  settings: IslandSettings;
  modules: ReadonlySet<OnboardingModule>;
  clipboard: ClipboardHistorySettings;
  islandOpen: boolean;
  onSettingsChange: (settings: IslandSettings) => void;
  onClipboardChange: (settings: ClipboardHistorySettings) => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.play;
  const [done, setDone] = useState<ReadonlySet<Task>>(() => new Set());
  const [finish] = useState(() => (task: Task) => setDone((current) => (current.has(task) ? current : new Set(current).add(task))));
  const [finishDrop] = useState(() => () => finish("drop"));
  const hover = settings.expandTrigger === "hover";
  const tasks: Task[] = ["expand"];
  if (modules.has("shelf")) tasks.push("drop");
  if (modules.has("clipboard") && clipboard.shortcutEnabled) tasks.push("shortcut");
  const doneCount = tasks.filter((task) => done.has(task)).length;

  if (islandOpen && !done.has("expand")) finish("expand");
  useShelfGrew(tasks.includes("drop") && !done.has("drop"), finishDrop);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listenClipboardPopupOpened(() => finish("shortcut"))
      .then((stop) => (cancelled ? stop() : (unlisten = stop)))
      .catch((error: unknown) => console.error("Failed to listen for the clipboard popup", error));
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [finish]);

  return (
    <>
      <ActHeading title={text.title} lead={doneCount === tasks.length ? text.allDone : text.lead} />
      <ol className="play-act__tasks" aria-label={text.stars(doneCount, tasks.length)}>
        {tasks.map((task) => (
          <li key={task} className={done.has(task) ? "play-act__task play-act__task--done" : "play-act__task"}>
            <Star className="play-act__star" size={18} aria-hidden="true" />
            <span className="play-act__task-text">
              {task === "expand" ? (hover ? text.hover : text.click) : task === "drop" ? text.drop : text.shortcut(clipboard.shortcut)}
              {task === "drop" && <small>{text.dropHint}</small>}
              {task === "shortcut" && <small>{text.shortcutHint}</small>}
            </span>
            {task === "expand" && (
              <SettingsChoice<ExpandTrigger>
                value={settings.expandTrigger}
                ariaLabel={text.expandBy}
                options={[{ value: "hover", label: text.expandHover }, { value: "click", label: text.expandClick }]}
                onChange={(expandTrigger) => onSettingsChange({ ...settings, expandTrigger })}
              />
            )}
            {task === "shortcut" && (
              <label className="play-act__winv">
                {text.winV}
                <SettingsSwitch id="onboarding-winv" checked={clipboard.winV} onChange={(winV) => onClipboardChange({ ...clipboard, winV })} />
              </label>
            )}
          </li>
        ))}
      </ol>
    </>
  );
}
