import type { ReactNode } from "react";

export function PluginMarketEmpty({ kind, icon, title, body, detail, children }: {
  kind: string;
  icon: ReactNode;
  title: string;
  body: string;
  detail?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="plugin-card plugin-empty" data-market-empty={kind}>
      <span className="plugin-empty__icon" aria-hidden="true">{icon}</span>
      <h3 className="plugin-empty__title">{title}</h3>
      <p>{body}</p>
      {children ? <div className="plugin-empty__actions">{children}</div> : null}
      {detail ? <p className="market-empty__detail">{detail}</p> : null}
    </div>
  );
}
