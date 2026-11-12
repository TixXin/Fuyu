import { FileText, FolderInput } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { OnboardingModule } from "./personas";

/** What the small island shows open in act 4: the dropped file, or the song and the agent at work. */
export function PlayPanel({ modules, file, dropping }: { modules: ReadonlySet<OnboardingModule>; file: string | null; dropping: boolean }) {
  const text = useTranslation().onboarding.play;

  if (dropping || file) {
    return (
      <div className="play-panel__shelf">
        {file ? <FileText size={18} aria-hidden="true" /> : <FolderInput size={18} aria-hidden="true" />}
        <span>{file ?? text.dropHere}</span>
      </div>
    );
  }

  return (
    <div className="play-panel">
      {modules.has("music") && (
        <div className="play-panel__row">
          <span className="play-panel__bars" aria-hidden="true"><i /><i /><i /><i /></span>
          <span>{text.nowPlaying} · {text.song}</span>
        </div>
      )}
      {modules.has("agents") && (
        <div className="play-panel__row">
          <span className="play-panel__agent" aria-hidden="true" />
          <span>{text.agentWorking}</span>
        </div>
      )}
    </div>
  );
}
