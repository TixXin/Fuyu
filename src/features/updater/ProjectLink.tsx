import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { useTranslation } from "../../i18n";
import { useOpenInBrowser } from "./useOpenInBrowser";

export function ProjectLink({
  href,
  title,
  hint,
  icon,
  tone,
}: {
  href: string;
  title: string;
  hint: string;
  icon: ReactNode;
  tone?: "star" | "release" | "website" | "community";
}) {
  const t = useTranslation();
  const { failed, onClick } = useOpenInBrowser();

  return (
    <>
      <a
        className={tone ? `project-link project-link--${tone}` : "project-link"}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
      >
        {icon}
        <span className="project-link__copy">
          <strong>{title}</strong>
          <span>{hint}</span>
        </span>
        <ExternalLink className="project-link__arrow" size={14} aria-hidden="true" />
      </a>
      {failed && (
        <p className="project-link-error" role="alert">{t.settings.project.openFailed}</p>
      )}
    </>
  );
}
