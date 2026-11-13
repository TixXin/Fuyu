import { BatteryMedium, ChevronUp, Code2, Folder, Globe, Search, Volume2, Wifi } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";

export type TaskbarApp = {
  id: string;
  icon: "folder" | "browser" | "editor" | { image: string };
  running?: boolean;
  focused?: boolean;
  badge?: { count: number; order: number };
};

const ICONS: Record<string, ReactNode> = {
  folder: <Folder size={22} strokeWidth={1.6} color="#f4c44e" fill="#f4c44e" fillOpacity={0.35} />,
  browser: <Globe size={22} strokeWidth={1.6} color="#55b6f2" />,
  editor: <Code2 size={22} strokeWidth={1.8} color="#4aa3ff" />,
};

function clock() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return { time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, date: `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}` };
}

export function Taskbar({ apps, scene }: { apps: TaskbarApp[]; scene: string }) {
  const [now] = useState(clock);
  return (
    <footer className="taskbar">
      <div className="taskbar__apps">
        <span className="taskbar__app">
          <span className="taskbar__start"><i /><i /><i /><i /></span>
        </span>
        <span className="taskbar__app"><Search size={20} strokeWidth={1.8} color="#e8ecf4" /></span>
        {apps.map((app) => (
          <span
            key={app.id}
            className={`taskbar__app${app.running ? " is-running" : ""}${app.focused ? " is-focused" : ""}${app.badge && scene === "busy" ? " is-flashing" : ""}`}
            style={{ "--order": app.badge?.order ?? 0 } as CSSProperties}
          >
            {typeof app.icon === "string" ? ICONS[app.icon] : <img src={app.icon.image} alt="" width={24} height={24} draggable={false} />}
            {app.badge && <mark>{app.badge.count}</mark>}
          </span>
        ))}
      </div>
      <div className="taskbar__tray">
        <ChevronUp size={15} strokeWidth={1.6} />
        <span className="taskbar__lang">中</span>
        <span className="taskbar__group">
          <Wifi size={15} strokeWidth={1.6} />
          <Volume2 size={15} strokeWidth={1.6} />
          <BatteryMedium size={17} strokeWidth={1.5} />
        </span>
        <span className="taskbar__clock"><b>{now.time}</b><b>{now.date}</b></span>
      </div>
    </footer>
  );
}
