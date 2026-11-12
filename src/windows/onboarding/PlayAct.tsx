import { useEffect, useRef, useState, type DragEvent } from "react";
import { FileText, Star } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import type { ExpandTrigger, IslandSettings } from "../../features/appearance/types";
import { listenClipboardPopupOpened, type ClipboardHistorySettings } from "../../features/clipboard/api";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import { MiniDesk } from "./MiniDesk";
import { MiniIsland } from "./MiniIsland";
import { PlayPanel } from "./PlayPanel";
import type { OnboardingModule } from "./personas";
import "./PlayAct.css";

const FILE_TYPE = "application/x-fuyu-demo-file";
const HOVER_OPEN_MS = 250;
const HOVER_CLOSE_MS = 600;

type Task = "expand" | "drop" | "shortcut";

/**
 * Act 4: the small desktop comes alive (music, an agent at work) and three little tasks teach the
 * island by hand: open it the way chosen, drop a file on it, and press the real clipboard shortcut.
 */
export function PlayAct({ settings, shown, modules, clipboard, onSettingsChange, onClipboardChange }: {
  settings: IslandSettings;
  shown: IslandSettings;
  modules: ReadonlySet<OnboardingModule>;
  clipboard: ClipboardHistorySettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onClipboardChange: (settings: ClipboardHistorySettings) => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.play;
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dropped, setDropped] = useState(false);
  const [done, setDone] = useState<ReadonlySet<Task>>(new Set());
  const timer = useRef(0);
  const hover = settings.expandTrigger === "hover";
  const tasks: Task[] = ["expand"];
  if (modules.has("shelf")) tasks.push("drop");
  if (modules.has("clipboard") && clipboard.shortcutEnabled) tasks.push("shortcut");
  const doneCount = tasks.filter((task) => done.has(task)).length;
  const finish = (task: Task) => setDone((current) => (current.has(task) ? current : new Set(current).add(task)));

  // The real shortcut opens the real clipboard window, which tells this window too.
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
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const open = () => {
    setExpanded(true);
    finish("expand");
  };
  const later = (action: () => void, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(action, ms);
  };
  const putFile = () => {
    setDropped(true);
    setDragging(false);
    setExpanded(true);
    finish("drop");
  };

  return (
    <>
      <MiniDesk
        island={
          <MiniIsland
            settings={shown}
            modules={modules}
            label={modules.has("music") && !expanded ? `${text.nowPlaying} · ${text.song}` : t.onboarding.islandName}
            live={modules.has("agents")}
            expanded={expanded}
            highlight={!done.has("expand") || dragging}
            ariaLabel={hover ? text.hover : text.click}
            panel={<PlayPanel modules={modules} file={dropped ? text.dropFile : null} dropping={dragging} />}
            onPointerEnter={() => hover && later(open, HOVER_OPEN_MS)}
            onPointerLeave={() => hover && !dragging && later(() => setExpanded(false), HOVER_CLOSE_MS)}
            onClick={() => (expanded ? setExpanded(false) : open())}
            onDragOver={(event: DragEvent<HTMLElement>) => {
              if (!event.dataTransfer.types.includes(FILE_TYPE)) return;
              event.preventDefault();
              setDragging(true);
              setExpanded(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              putFile();
            }}
          />
        }
      >
        {tasks.includes("drop") && !dropped && (
          <div
            className="play-act__file"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(FILE_TYPE, "demo");
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDragging(false)}
          >
            <FileText size={28} strokeWidth={1.5} aria-hidden="true" />
            <span>{text.dropFile}</span>
          </div>
        )}
      </MiniDesk>
      <ActHeading title={text.title} lead={doneCount === tasks.length ? text.allDone : text.lead} />
      <ol className="play-act__tasks" aria-label={text.stars(doneCount, tasks.length)}>
        {tasks.map((task) => (
          <li key={task} className={done.has(task) ? "play-act__task play-act__task--done" : "play-act__task"}>
            <Star className="play-act__star" size={18} aria-hidden="true" />
            <span className="play-act__task-text">
              {task === "expand" ? (hover ? text.hover : text.click) : task === "drop" ? text.drop : text.shortcut(clipboard.shortcut)}
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
            {task === "drop" && !dropped && (
              <button className="onboarding__button" type="button" onClick={putFile}>{text.dropKeyboard}</button>
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
