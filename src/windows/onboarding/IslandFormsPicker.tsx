import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { SettingsChoice } from "../../components/settings/SettingsChoice";
import { useTranslation } from "../../i18n";
import type { OnboardingFormId } from "../../i18n/sections/onboarding";
import { dockIslandTo } from "../../lib/settings/api";
import type { IslandForm, IslandSettings, TaskbarLook } from "../../lib/settings/types";
import { useIslandDockEdge } from "../settings/sections/useIslandDockEdge";
import { useIslandTaskbar } from "../settings/sections/useIslandTaskbar";
import { requestIslandPositionReset } from "../settings/storage";
import "./IslandFormsPicker.css";

const TOP_FORMS: readonly IslandForm[] = ["top", "pill", "notch"];

export function activeOnboardingForm(
  edge: "top" | "bottom" | "left" | "right" | null,
  taskbarDocked: boolean,
  islandForm: IslandForm,
): OnboardingFormId {
  if (taskbarDocked && edge === "bottom") return "taskbar";
  if (edge === "bottom" || edge === "left" || edge === "right") return edge;
  if (islandForm === "pill" || islandForm === "notch") return islandForm;
  return "top";
}

export function IslandFormsPicker({
  settings,
  onSettingsChange,
  onUserInteract,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onUserInteract?: () => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.shape;
  const edge = useIslandDockEdge();
  const taskbar = useIslandTaskbar();
  const [optimistic, setOptimistic] = useState<OnboardingFormId | null>(null);
  const [touring, setTouring] = useState(false);
  const timerRef = useRef<number>(0);

  const forms: OnboardingFormId[] = taskbar.available
    ? ["top", "pill", "notch", "bottom", "left", "right", "taskbar"]
    : ["top", "pill", "notch", "bottom", "left", "right"];
  const current = optimistic ?? activeOnboardingForm(edge, taskbar.docked, settings.islandForm);

  useEffect(() => {
    setOptimistic(null);
  }, [edge, taskbar.docked, settings.islandForm]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const applyForm = (id: OnboardingFormId, fromUser = true) => {
    if (fromUser) {
      window.clearTimeout(timerRef.current);
      setTouring(false);
      onUserInteract?.();
    }
    setOptimistic(id);
    if (TOP_FORMS.includes(id as IslandForm)) {
      if (!TOP_FORMS.includes(current as IslandForm) || (edge !== null && edge !== "top")) {
        requestIslandPositionReset();
      }
      onSettingsChange({ ...settings, islandForm: id as IslandForm });
      return;
    }
    if (id === "bottom" || id === "left" || id === "right" || id === "taskbar") {
      void dockIslandTo(id).catch((error: unknown) => console.error("Failed to dock the island", error));
    }
  };

  const toggleTour = () => {
    if (touring) {
      window.clearTimeout(timerRef.current);
      setTouring(false);
      return;
    }
    onUserInteract?.();
    const startForm = current;
    const sequence: OnboardingFormId[] = [...forms.filter((item) => item !== startForm), startForm];
    setTouring(true);
    let step = 0;
    const runNext = () => {
      if (step >= sequence.length) {
        setTouring(false);
        return;
      }
      applyForm(sequence[step], false);
      step += 1;
      timerRef.current = window.setTimeout(runNext, 950);
    };
    runNext();
  };

  return (
    <div className="island-forms">
      <div className="island-forms__head">
        <span className="island-forms__label">
          {text.formTitle}
          <span className="island-forms__hint"> · {text.formHints[current]}</span>
        </span>
        <button
          className={touring ? "onboarding__chip-btn onboarding__chip-btn--active" : "onboarding__chip-btn"}
          type="button"
          onClick={toggleTour}
        >
          {touring ? <Square size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
          {touring ? text.stopTourForms : text.tourForms}
        </button>
      </div>
      <div className="island-forms__grid" role="radiogroup" aria-label={text.formTitle}>
        {forms.map((id) => {
          const active = current === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              data-island-form={id}
              className={active ? "island-forms__card island-forms__card--active" : "island-forms__card"}
              onClick={() => applyForm(id, true)}
            >
              <span className={`island-forms__mini island-forms__mini--${id}`} aria-hidden="true">
                <b />
                <i />
              </span>
              <span className="island-forms__name">{text.forms[id]}</span>
            </button>
          );
        })}
      </div>
      {current === "taskbar" && (
        <div className="island-forms__taskbar">
          <span>{text.taskbarLook}</span>
          <SettingsChoice<TaskbarLook>
            value={settings.taskbarLook}
            ariaLabel={text.taskbarLook}
            options={(["transparent", "theme"] as const).map((value) => ({
              value,
              label: t.settings.position.taskbarLookOptions[value],
            }))}
            onChange={(taskbarLook) => onSettingsChange({ ...settings, taskbarLook })}
          />
        </div>
      )}
    </div>
  );
}
