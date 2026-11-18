import type { Context } from "@fuyu/plugin-base";
import { useRef, useState, type ChangeEvent } from "react";
import { MAX_BG_LENGTH, METHODS, daysDelta, primaryCountdown, sortCountdownItems } from "./model.ts";
import { text } from "./text.ts";
import { useCountdown } from "./useCountdown.ts";
import "./styles.css";

function CountdownIcon({ size = 16 }: { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function defaultTargetDate(): string {
  const dt = new Date(Date.now() + 7 * 86_400_000);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function deltaLabel(days: number): string {
  if (days === 0) return text.today;
  return days > 0 ? text.daysLeft(days) : text.daysPast(Math.abs(days));
}

export default function apply(ctx: Context) {
  function CountdownPage() {
    const { state, error, setError, invoke } = useCountdown(ctx);
    const [title, setTitle] = useState("");
    const [date, setDate] = useState(defaultTargetDate);
    const [bgTargetId, setBgTargetId] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement | null>(null);

    const at = state.at || Date.now();
    const sorted = sortCountdownItems(state.items, at);
    const hero = sorted[0] ?? null;

    function handleAdd() {
      if (!title.trim() || !date) return;
      invoke(METHODS.add, { title: title.trim(), date });
      setTitle("");
    }

    function pickBg(id: string) {
      setBgTargetId(id);
      fileRef.current?.click();
    }

    function onFileChange(event: ChangeEvent<HTMLInputElement>) {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !bgTargetId) return;
      if (file.size > 512_000) {
        setError(text.bgTooLarge);
        return;
      }
      const targetId = bgTargetId;
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : null;
        if (result && result.length <= MAX_BG_LENGTH) {
          invoke(METHODS.setBackground, { id: targetId, backgroundDataUrl: result });
        } else {
          setError(text.bgTooLarge);
        }
      };
      reader.readAsDataURL(file);
    }

    return (
      <div className="fuyu-countdown">
        <input ref={fileRef} type="file" accept="image/*" className="fuyu-countdown__file" onChange={onFileChange} />

        {hero ? (
          <div
            className={hero.backgroundDataUrl ? "fuyu-countdown__hero fuyu-countdown__hero--image" : "fuyu-countdown__hero"}
            style={hero.backgroundDataUrl ? { backgroundImage: `url(${hero.backgroundDataUrl})` } : undefined}
          >
            <div className="fuyu-countdown__hero-shade">
              <div className="fuyu-countdown__hero-main">
                <span className="fuyu-countdown__hero-title">{hero.title}</span>
                <span className="fuyu-countdown__hero-date">{hero.date}</span>
              </div>
              <span className="fuyu-countdown__hero-days">{deltaLabel(daysDelta(hero.date, at))}</span>
            </div>
          </div>
        ) : (
          <p className="fuyu-countdown__note">{text.empty}</p>
        )}

        <div className="fuyu-countdown__form">
          <input
            type="text"
            className="fuyu-countdown__input"
            placeholder={text.titlePlaceholder}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input type="date" className="fuyu-countdown__date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button type="button" className="fuyu-countdown__button" disabled={!title.trim()} onClick={handleAdd}>
            {text.add}
          </button>
        </div>

        {sorted.length > 0 && (
          <ul className="fuyu-countdown__list">
            {sorted.map((item) => {
              const delta = daysDelta(item.date, at);
              return (
                <li key={item.id} className="fuyu-countdown__row">
                  <div className="fuyu-countdown__row-info">
                    <span className="fuyu-countdown__row-title">{item.title}</span>
                    <span className="fuyu-countdown__row-sub">
                      {item.date} · {deltaLabel(delta)}
                    </span>
                  </div>
                  <div className="fuyu-countdown__row-actions">
                    <button
                      type="button"
                      className={item.pinned ? "fuyu-countdown__mini fuyu-countdown__mini--active" : "fuyu-countdown__mini"}
                      onClick={() => invoke(METHODS.pin, { id: item.id })}
                    >
                      {item.pinned ? text.pinned : text.pin}
                    </button>
                    {item.backgroundDataUrl ? (
                      <button
                        type="button"
                        className="fuyu-countdown__mini"
                        onClick={() => invoke(METHODS.setBackground, { id: item.id, backgroundDataUrl: null })}
                      >
                        {text.clearBg}
                      </button>
                    ) : (
                      <button type="button" className="fuyu-countdown__mini" onClick={() => pickBg(item.id)}>
                        {text.setBg}
                      </button>
                    )}
                    <button type="button" className="fuyu-countdown__mini" onClick={() => invoke(METHODS.remove, { id: item.id })}>
                      {text.remove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {error && <p className="fuyu-countdown__note">{error}</p>}
      </div>
    );
  }

  function CountdownCollapsed() {
    const { state } = useCountdown(ctx);
    if (!state.showInBar) return null;
    const at = state.at || Date.now();
    const primary = primaryCountdown(state.items, at);
    if (!primary) return null;
    const delta = daysDelta(primary.date, at);
    return (
      <span className="fuyu-countdown-chip" title={`${primary.title} (${primary.date})`}>
        <CountdownIcon size={12} />
        <span className="fuyu-countdown-chip__days">{text.barChip(delta)}</span>
      </span>
    );
  }

  ctx.slots.add("island.page/v1", { id: "countdown", component: CountdownPage, icon: CountdownIcon });
  ctx.slots.add("island.collapsed/v1", { id: "countdown-bar", width: 54, hideable: true, component: CountdownCollapsed });
}
