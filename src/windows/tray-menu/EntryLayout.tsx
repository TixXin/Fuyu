import { Bot, CalendarDays, ClipboardX, FolderUp, Gamepad2, ListTodo, NotebookPen, Zap } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { TrayMenuPage } from "./api";
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
  return (
    <>
      <TrayCardHeader {...props} />
      <div className="tray-card__entry-main">
        <IslandButton variant="primary" {...props} />
        <FeatureButton feature="screenshot" variant="tile" showShortcut {...props} />
        <FeatureButton feature="translate" variant="tile" showShortcut {...props} />
        <FeatureButton feature="clipboard" variant="tile" showShortcut {...props} />
      </div>
      <div className="tray-card__strip">
        <span className="tray-card__strip-label">{text.open}</span>
        {PAGES.map(([page, Icon]) => (
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
      <div className="tray-card__switches">
        <TraySwitch label={text.dnd} icon={<Gamepad2 size={16} aria-hidden="true" />} checked={data.dnd} onToggle={handlers.onDnd} />
        <TraySwitch
          label={text.clipPaused}
          icon={<ClipboardX size={16} aria-hidden="true" />}
          checked={data.state.clipboardPaused}
          onToggle={() => handlers.onAction("toggle_clipboard_pause")}
        />
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
