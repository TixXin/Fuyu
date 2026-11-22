import type { ReactNode } from "react";
import { Bell, Languages, LayoutDashboard, Scissors, Settings, type LucideIcon } from "lucide-react";
import type { PanelIconComponent } from "../../../components/island-widget/panelIcons";
import { useTranslation } from "../../../i18n";
import type { IslandPageRow } from "./useIslandPageRows";

const HEADER_BUTTON_ICONS: Record<string, LucideIcon> = { qq: Bell, translation: Languages };

type PreviewHeaderProps = {
  rows: readonly IslandPageRow[];
  current: IslandPageRow | undefined;
  notch: boolean;
  showTitle: boolean;
  screenshot: boolean;
  onPage: (id: string) => void;
};

function Decor({ icon: Icon, kind }: { icon: LucideIcon; kind: string }) {
  return (
    <span className="expanded-preview__action" data-action={kind} aria-hidden="true">
      <Icon size={15} strokeWidth={1.8} absoluteStrokeWidth />
    </span>
  );
}

export function PreviewHeader({ rows, current, notch, showTitle, screenshot, onPage }: PreviewHeaderProps) {
  const t = useTranslation();
  const shown = rows.filter((row) => !row.hidden && !row.off);
  const tab = (row: IslandPageRow, Icon: PanelIconComponent, kind: "page" | "button") => (
    <button
      key={row.id}
      className={`expanded-preview__tab expanded-preview__tab--${kind}`}
      type="button"
      data-page={row.id}
      aria-pressed={row.id === current?.id}
      aria-label={row.name}
      title={row.name}
      onClick={() => onPage(row.id)}
    >
      <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
  const tabs = shown.filter((row) => row.headerDot || row.id === "agents").map((row) => tab(row, row.icon, "page"));
  const lead: ReactNode[] = [
    ...shown.filter((row) => !row.headerDot && row.id !== "agents").map((row) => tab(row, HEADER_BUTTON_ICONS[row.id] ?? row.icon, "button")),
    screenshot ? <Decor key="screenshot" icon={Scissors} kind="screenshot" /> : null,
  ];
  const trailing = [
    current?.panel ? <Decor key="layout" icon={LayoutDashboard} kind="layout" /> : null,
    <Decor key="settings" icon={Settings} kind="settings" />,
  ];
  return (
    <div className="expanded-preview__head" data-notch={notch || undefined}>
      <div className="expanded-preview__head-start">
        <div className="expanded-preview__tabs">
          {tabs}
          {showTitle ? <span className="expanded-preview__title">{t.island.appName}</span> : null}
        </div>
        {notch ? null : lead}
      </div>
      {notch ? <span className="expanded-preview__notch" aria-hidden="true" /> : <span className="expanded-preview__gap" aria-hidden="true" />}
      <div className="expanded-preview__head-end" role="group" aria-label={t.settings.islandPages.preview.actions}>
        {notch ? lead : null}
        {trailing}
      </div>
    </div>
  );
}
