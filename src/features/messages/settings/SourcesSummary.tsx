import type { ReactNode } from "react";
import { MessageCircle, TriangleAlert } from "lucide-react";
import { useTranslation } from "../../../i18n";
import type { SourcesSummary as Summary } from "./sourceRows.ts";

export function SourcesSummary({ icons, summary, hint }: { icons: ReactNode[]; summary: Summary; hint: string }) {
  const labels = useTranslation().settings.messageSources;
  const { on, problems, busy } = summary;

  return (
    <section className="settings-group">
      <div className="source-summary" data-search="off">
        {icons.length > 0 ? (
          <span className="source-summary__stack" aria-hidden="true">
            {icons.slice(0, 6).map((icon, index) => <span className="source-summary__icon" key={index}>{icon}</span>)}
          </span>
        ) : (
          <span className="source-summary__icon source-summary__icon--empty" aria-hidden="true"><MessageCircle size={16} strokeWidth={1.9} /></span>
        )}
        <span className="source-summary__text">
          <strong>{labels.sourcesOn(on)}</strong>
          <span>{hint}</span>
        </span>
        {on === 0 ? null : problems > 0 ? (
          <span className="source-summary__pill" data-tone="warn" role="status"><TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />{labels.needsAttention(problems)}</span>
        ) : busy > 0 ? (
          <span className="source-summary__pill" data-tone="busy" role="status"><span className="source-row__dot" aria-hidden="true" />{labels.connecting(busy)}</span>
        ) : (
          <span className="source-summary__pill" data-tone="ok" role="status"><span className="source-row__dot" aria-hidden="true" />{labels.allReceiving}</span>
        )}
      </div>
    </section>
  );
}
