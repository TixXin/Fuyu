import { ExternalLink } from "lucide-react";
import { openCcConnectLink } from "../../../features/cc-connect/api";
import { useTranslation } from "../../../i18n";
import { isPushPlatform, PUSH_PLATFORMS, type PushPlatform } from "./platforms";

export function PlatformStep({ platform, onChange }: { platform: PushPlatform; onChange: (platform: PushPlatform) => void }) {
  const text = useTranslation().onboarding.push.platform;
  const open = (url: string) => void openCcConnectLink(url).catch((error: unknown) => console.error("Failed to open a link", error));
  return (
    <>
      <p className="push-act__lead">{text.lead}</p>
      <div className="push-act__platforms" role="radiogroup" aria-label={text.lead}>
        {PUSH_PLATFORMS.map((info) => {
          const id = info.id;
          const chosen = id === platform;
          return (
            <div key={id} className={`push-act__platform${chosen ? " push-act__platform--chosen" : ""}${info.usable ? "" : " push-act__platform--off"}`}>
              <button
                className="push-act__platform-pick"
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={!info.usable}
                onClick={() => isPushPlatform(id) && onChange(id)}
              >
                <span className="push-act__name">
                  {text.names[id]}
                  {info.recommended ? <span className="push-act__badge">{text.recommended}</span> : null}
                </span>
                <span className="push-act__note">{text.hints[id]}</span>
              </button>
              <div className="push-act__links">
                <button className="push-act__link" type="button" onClick={() => open(info.create)}>
                  {text.create}
                  <ExternalLink size={11} aria-hidden="true" />
                </button>
                <button className="push-act__link" type="button" onClick={() => open(info.guide)}>
                  {text.guide}
                  <ExternalLink size={11} aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
