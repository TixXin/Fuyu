import { Briefcase, Coffee, Sparkles } from "lucide-react";
import { useTranslation } from "../../i18n";
import { PANEL_TEMPLATES, type PanelTemplate } from "../../lib/settings/panelTemplates";
import "./PanelTemplateButtons.css";

const ICONS = { fuyu: Sparkles, workbench: Briefcase, fun: Coffee } as const;

export function PanelTemplateButtons({ onPick }: { onPick: (template: PanelTemplate) => void }) {
  const t = useTranslation().islandWidgets.panel;
  return (
    <div className="panel-templates">
      {PANEL_TEMPLATES.map((template) => {
        const Icon = ICONS[template];
        return (
          <button key={template} className="panel-templates__button" type="button" data-template={template} onClick={() => onPick(template)}>
            <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
            <strong>{t.templates[template]}</strong>
            <small>{t.templateDetail[template]}</small>
          </button>
        );
      })}
    </div>
  );
}
