import type { Context } from "@fuyu/plugin-base";
import { useState } from "react";
import { TEXT } from "./model.ts";
import { useLauncher } from "./useLauncher.ts";
import "./styles.css";

export default function apply(ctx: Context) {
  function LauncherSettingsSection() {
    const { state, locale, busy, error, rescan, clearRecent } = useLauncher(ctx);
    const copy = TEXT[locale];
    const [notice, setNotice] = useState<string | null>(null);

    const handleRescan = async () => {
      setNotice(null);
      const next = await rescan();
      if (next) {
        setNotice(copy.rescanDone(next.totalCount));
      }
    };

    const handleClearRecent = async () => {
      setNotice(null);
      const next = await clearRecent();
      if (next) {
        setNotice(copy.clearedDone);
      }
    };

    return (
      <section className="fuyu-launcher-settings">
        <div className="fuyu-launcher-settings__top">
          <h3 className="fuyu-launcher-settings__title">{copy.title}</h3>
          <span className="fuyu-launcher-settings__sub">
            {copy.settingsSummary(state.totalCount, state.recentCount)}
          </span>
        </div>

        <div className="fuyu-launcher-settings__actions">
          <button
            type="button"
            className="fuyu-launcher__button"
            disabled={busy}
            onClick={() => void handleRescan()}
          >
            {copy.rescan}
          </button>
          <button
            type="button"
            className="fuyu-launcher__button fuyu-launcher__button--secondary"
            disabled={busy || state.recentCount === 0}
            onClick={() => void handleClearRecent()}
          >
            {copy.clearRecent}
          </button>
        </div>

        {notice && !error && <p className="fuyu-launcher__note">{notice}</p>}
        {error && <p className="fuyu-launcher__note">{error}</p>}
      </section>
    );
  }

  ctx.slots.add("settings.section/v1", {
    id: "@fuyu/launcher",
    category: "pluginsV3",
    component: LauncherSettingsSection,
  });
}
