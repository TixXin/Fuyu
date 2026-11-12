import { useLayoutEffect, useState } from "react";
import type { AgentSessionSummary } from "./api";
import { sessionKey } from "./unseen";
import type { SessionRemoval } from "./useHiddenSessions";
import type { AgentArchiveMotion } from "../appearance/types";
import "./ArchiveDissolve.css";

const LEAVE_MS = 260;
const RETURN_MS = 240;
const EASING = "cubic-bezier(0.2, 0.7, 0.3, 1)";
const SLIDE_PX = 18;

export const DISSOLVE_MS = 480;
const FOLD_MS = 160;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function dustColor(element: HTMLElement) {
  const card = element.querySelector<HTMLElement>(".agent-card");
  if (card) return getComputedStyle(card).getPropertyValue("--card-color").trim();
  const dot = element.querySelector<HTMLElement>(".agent-session__dot");
  return dot ? getComputedStyle(dot).backgroundColor : "";
}

function dissolve(element: HTMLElement, then: () => void) {
  const color = dustColor(element);
  if (color) element.style.setProperty("--dust-color", color);
  const dust = document.createElement("span");
  dust.className = "agent-dissolve__dust";
  dust.setAttribute("aria-hidden", "true");
  element.append(dust);
  element.classList.add("agent-dissolving");
  window.setTimeout(then, DISSOLVE_MS);
}

function undissolve(element: HTMLElement) {
  element.classList.remove("agent-dissolving");
  element.querySelector(":scope > .agent-dissolve__dust")?.remove();
  element.style.removeProperty("--dust-color");
}

export function useArchiveMotion(list: HTMLElement | null, removal: SessionRemoval | undefined, style: AgentArchiveMotion = "slide") {
  const [returning, setReturning] = useState<string | null>(null);
  const row = (key: string) => list?.querySelector<HTMLElement>(`[data-session-key="${CSS.escape(key)}"]`) ?? null;

  useLayoutEffect(() => {
    if (!returning) return;
    const element = list?.querySelector<HTMLElement>(`[data-session-key="${CSS.escape(returning)}"]`);
    if (element && !reducedMotion()) {
      const height = element.offsetHeight;
      element.style.overflow = "hidden";
      element
        .animate(
          [
            { opacity: 0, transform: `translateX(${SLIDE_PX}px)`, height: "0px" },
            { opacity: 0, transform: `translateX(${SLIDE_PX}px)`, height: `${height}px`, offset: 0.45 },
            { opacity: 1, transform: "translateX(0)", height: `${height}px` },
          ],
          { duration: RETURN_MS, easing: EASING },
        )
        .finished.finally(() => element.style.removeProperty("overflow"))
        .catch(() => undefined);
    }
    setReturning(null);
  }, [returning, list]);

  const removeAfter = (session: AgentSessionSummary, element: HTMLElement, animation: Animation, cleanup?: () => void) => {
    void animation.finished
      .catch(() => undefined)
      .finally(() => {
        removal?.remove(session);
        requestAnimationFrame(() => {
          animation.cancel();
          cleanup?.();
          element.style.removeProperty("overflow");
          element.style.removeProperty("pointer-events");
        });
      });
  };

  const archive = (session: AgentSessionSummary) => {
    if (!removal) return;
    const element = row(sessionKey(session));
    if (!element || reducedMotion()) {
      removal.remove(session);
      return;
    }
    const height = element.offsetHeight;
    element.style.overflow = "hidden";
    element.style.pointerEvents = "none";
    if (style === "dissolve") {
      dissolve(element, () => {
        const fold = element.animate([{ height: `${height}px` }, { height: "0px" }], { duration: FOLD_MS, easing: EASING, fill: "forwards" });
        removeAfter(session, element, fold, () => undissolve(element));
      });
      return;
    }
    const animation = element.animate(
      [
        { opacity: 1, transform: "translateX(0)", height: `${height}px` },
        { opacity: 0, transform: `translateX(${SLIDE_PX}px)`, height: `${height}px`, offset: 0.5 },
        { opacity: 0, transform: `translateX(${SLIDE_PX}px)`, height: "0px" },
      ],
      { duration: LEAVE_MS, easing: EASING, fill: "forwards" },
    );
    removeAfter(session, element, animation);
  };

  const undo = () => {
    if (!removal?.removed) return;
    setReturning(sessionKey(removal.removed));
    removal.undo();
  };

  return { archive, undo };
}
