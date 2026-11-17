import { useRef, useState } from "react";
import { CC_CONNECT_AGENT_LABELS } from "../../../lib/cc-connect/labels";
import { useTranslation } from "../../../i18n";
import { ConnectRow } from "./ConnectRow";
import type { PlannedProject, TargetEntry } from "./plan";
import type { PushPlatform } from "./platforms";

export function ConnectStep({ entries, projects, platform, connected, onConnected }: {
  entries: readonly TargetEntry[];
  projects: readonly PlannedProject[];
  platform: PushPlatform;
  connected: ReadonlySet<string>;
  onConnected: (key: string) => void;
}) {
  const text = useTranslation().onboarding.push;
  const [scanning, setScanning] = useState<string | null>(null);
  const prepared = useRef(new Set<string>());
  if (projects.length === 0) return <p className="push-act__lead">{text.connect.none}</p>;

  return (
    <>
      <p className="push-act__lead">{text.connect.lead(text.platform.names[platform])}</p>
      <ul className="push-act__list">
        {projects.map((project) => {
          const entry = entries.find((found) => found.target.id === project.targetId);
          if (!entry) return null;
          const prepare = async () => {
            if (prepared.current.has(entry.target.id)) return;
            await entry.target.prepare();
            prepared.current.add(entry.target.id);
          };
          return (
            <ConnectRow
              key={`${project.key}:${platform}`}
              target={entry.target}
              project={project}
              title={`${entry.target.label ?? text.thisComputer} · ${CC_CONNECT_AGENT_LABELS[project.agent] ?? project.agent}`}
              platform={platform}
              connected={connected.has(project.key)}
              scanning={scanning}
              onScanning={setScanning}
              prepare={prepare}
              onConnected={() => onConnected(project.key)}
            />
          );
        })}
      </ul>
    </>
  );
}
