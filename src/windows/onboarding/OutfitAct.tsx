import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Calendar,
  Camera,
  Check,
  ClipboardList,
  FolderInput,
  Languages,
  ListTodo,
  Mail,
  Mic,
  Music,
  Play,
  Square,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "../../i18n";
import type { IslandPage } from "../island/types";
import { ActHeading } from "./ActHeading";
import {
  MODULES,
  MODULE_PREVIEW_PAGES,
  PERSONAS,
  personaModules,
  takenOff,
  togglePersona,
  type OnboardingModule,
  type Persona,
  type PersonaAnswer,
} from "./personas";
import { SideDockSplitCard } from "./SideDockSplitCard";
import "./OutfitAct.css";

const MODULE_ICONS: Record<OnboardingModule, LucideIcon> = {
  todo: ListTodo,
  calendar: Calendar,
  music: Music,
  agents: Bot,
  translation: Languages,
  shelf: FolderInput,
  mail: Mail,
  screenshot: Camera,
  clipboard: ClipboardList,
  timer: Timer,
  voice: Mic,
};

export function OutfitAct({
  modules,
  answer,
  onAnswerChange,
  onModulesChange,
  onPreviewPage,
  onCollapsePreview,
  onUserInteract,
  onWingsPreview,
}: {
  modules: ReadonlySet<OnboardingModule>;
  answer: PersonaAnswer;
  onAnswerChange: (answer: PersonaAnswer) => void;
  onModulesChange: (modules: ReadonlySet<OnboardingModule>) => void;
  onPreviewPage: (page: IslandPage) => void;
  onCollapsePreview: () => void;
  onUserInteract: () => void;
  onWingsPreview?: (open: boolean) => void;
}) {
  const text = useTranslation().onboarding.outfit;
  const [focused, setFocused] = useState<OnboardingModule>("agents");
  const [touring, setTouring] = useState(false);
  const timerRef = useRef<number>(0);
  const names = (list: readonly OnboardingModule[]) => text.list(list.map((module) => text.modules[module]));
  const removed = takenOff(answer, modules);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timerRef.current);
        setTouring(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(timerRef.current);
    };
  }, []);

  const stopTour = () => {
    window.clearTimeout(timerRef.current);
    setTouring(false);
  };

  const pick = (persona: Persona) => {
    stopTour();
    const next = togglePersona(answer, persona, modules);
    onAnswerChange(next.answer);
    onModulesChange(next.modules);
  };

  const toggleModule = (module: OnboardingModule) => {
    stopTour();
    setFocused(module);
    const next = new Set(modules);
    if (next.has(module)) next.delete(module);
    else next.add(module);
    onModulesChange(next);
  };

  const toggleTour = () => {
    if (touring) {
      stopTour();
      return;
    }
    const previewable = MODULES.filter((module) => modules.has(module) && MODULE_PREVIEW_PAGES[module]);
    if (previewable.length === 0) return;
    setTouring(true);
    let idx = 0;
    const step = () => {
      if (document.hidden || idx >= previewable.length) {
        setTouring(false);
        if (idx >= previewable.length) onCollapsePreview();
        return;
      }
      const mod = previewable[idx];
      setFocused(mod);
      const page = MODULE_PREVIEW_PAGES[mod];
      if (page) onPreviewPage(page);
      idx += 1;
      timerRef.current = window.setTimeout(step, 2000);
    };
    step();
  };

  const FocusedIcon = MODULE_ICONS[focused];
  const previewPage = MODULE_PREVIEW_PAGES[focused];

  return (
    <>
      <div className="outfit-act__top">
        <ActHeading title={text.title} lead={text.lead} />
        <button className="onboarding__chip-btn" type="button" onClick={toggleTour}>
          {touring ? <Square size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
          {touring ? text.tourStop : text.tourStart}
        </button>
      </div>

      <p className="outfit-act__question">{text.personaQuestion}</p>
      <div className="outfit-act__personas">
        {PERSONAS.map((persona) => {
          const chosen = answer.personas.includes(persona);
          return (
            <button
              key={persona}
              className={chosen ? "outfit-act__persona outfit-act__persona--chosen" : "outfit-act__persona"}
              type="button"
              aria-pressed={chosen}
              onClick={() => pick(persona)}
            >
              <span className="outfit-act__persona-name">{text.personas[persona]}</span>
              <span className="outfit-act__persona-hint">{names(personaModules(persona))}</span>
              {chosen && <Check className="outfit-act__persona-check" size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="outfit-act__split">
        <div>
          <div className="outfit-act__sticker-head">
            <p className="outfit-act__question">{text.stickersHint}</p>
            <span className="outfit-act__count">{text.selectedCount(modules.size, MODULES.length)}</span>
          </div>
          <div className="outfit-act__stickers" role="group" aria-label={text.stickers}>
            {MODULES.map((module) => {
              const Icon = MODULE_ICONS[module];
              const on = modules.has(module);
              return (
                <button
                  key={module}
                  className={[
                    "outfit-act__sticker",
                    on ? "outfit-act__sticker--on" : "",
                    focused === module ? "outfit-act__sticker--focused" : "",
                  ].filter(Boolean).join(" ")}
                  type="button"
                  aria-pressed={on}
                  onMouseEnter={() => setFocused(module)}
                  onClick={() => toggleModule(module)}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span className="outfit-act__sticker-name">{text.modules[module]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="outfit-act__preview">
          <div className="outfit-act__preview-head">
            <span>{text.previewLabel}</span>
            <span className={modules.has(focused) ? "outfit-act__badge outfit-act__badge--on" : "outfit-act__badge"}>
              {modules.has(focused) ? text.enabledBadge : text.disabledBadge}
            </span>
          </div>
          <div className="outfit-act__preview-card">
            <div className="outfit-act__preview-title">
              <FocusedIcon size={16} aria-hidden="true" />
              <span>{text.modules[focused]}</span>
            </div>
            <p className="outfit-act__preview-desc">{text.moduleDescs[focused]}</p>
          </div>
          {previewPage && modules.has(focused) && (
            <button
              type="button"
              className="onboarding__button"
              onClick={() => {
                stopTour();
                onPreviewPage(previewPage);
              }}
            >
              {text.demoThis}
            </button>
          )}
        </aside>
      </div>
      {removed.length > 0 && <p className="outfit-act__removed" role="status">{text.takenOff(names(removed))}</p>}
      <SideDockSplitCard onUserInteract={onUserInteract} onWingsPreview={onWingsPreview} />
    </>
  );
}
