import { Bot, CalendarDays, ClipboardX, FolderUp, Gamepad2, ListTodo, NotebookPen, Zap } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayMenuPage } from "./api";
import { columns, entryShown, shownFeatures } from "./builtinEntries";
import { FeatureButton } from "./FeatureButton";
import { IslandButton } from "./IslandButton";
import { TrayCardFooter } from "./TrayCardFooter";
import { TrayCardHeader } from "./TrayCardHeader";
import { TraySwitch } from "./TraySwitch";
import type { TrayCardProps } from "./types";

const PAGES: readonly [TrayMenuPage, typeof ListTodo][] = [
  ["todo", ListTodo],
  ["notes", NotebookPen],
  ["calendar", CalendarDays],
  ["file-shelf", FolderUp],
  ["agent", Bot],
];

export function EntryLayout(props: TrayCardProps) {
  const text = useTranslation().trayMenu;
  const { data, handlers } = props;
  const mac = data.state.platform === "macos";
  const features = shownFeatures(data.off, ["screenshot", "translate", "clipboard"]);
  const pages = PAGES.filter(([page]) => entryShown(data.off, page));
  return (
    <>
      <TrayCardHeader {...props} />
      <div className="tray-card__entry-main" style={columns(features.length)}>
        <IslandButton variant="primary" {...props} />
        {features.map((feature) => <FeatureButton key={feature} feature={feature} variant="tile" showShortcut {...props} />)}
      </div>
      {pages.length > 0 ? (
      <div className="tray-card__strip">
        <span className="tray-card__strip-label">{text.open}</span>
        {pages.map(([page, Icon]) => (
          <button
            key={page}
            type="button"
            className="tray-card__icon-button"
            aria-label={text.openPage(text.pages[page])}
            title={text.pages[page]}
            onClick={() => handlers.onAction("open_page", page)}
          >
            <Icon size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      ) : null}
      <div className="tray-card__switches">
        <TraySwitch label={text.dnd} icon={<Gamepad2 size={16} aria-hidden="true" />} checked={data.dnd} onToggle={handlers.onDnd} />
        {entryShown(data.off, "clipboard") ? (
        <TraySwitch
          label={text.clipPaused}
          icon={<ClipboardX size={16} aria-hidden="true" />}
          checked={data.state.clipboardPaused}
          onToggle={() => handlers.onAction("toggle_clipboard_pause")}
        />
        ) : null}
        <TraySwitch
          label={mac ? text.autostartMac : text.autostart}
          icon={<Zap size={16} aria-hidden="true" />}
          checked={data.autostart}
          onToggle={handlers.onAutostart}
        />
      </div>
      <TrayCardFooter handlers={handlers} />
    </>
  );
}
