import { useState } from "react";
import { Bot, Camera, Check, ClipboardList, FolderInput, Languages, ListTodo, Mail, Music, type LucideIcon } from "lucide-react";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import { MODULES, PERSONAS, modulesFor, type OnboardingModule, type Persona } from "./personas";
import "./OutfitAct.css";

const MODULE_ICONS: Record<OnboardingModule, LucideIcon> = {
  todo: ListTodo,
  music: Music,
  agents: Bot,
  translation: Languages,
  shelf: FolderInput,
  mail: Mail,
  screenshot: Camera,
  clipboard: ClipboardList,
};

export function OutfitAct({ modules, onModulesChange }: {
  modules: ReadonlySet<OnboardingModule>;
  onModulesChange: (modules: ReadonlySet<OnboardingModule>) => void;
}) {
  const text = useTranslation().onboarding.outfit;
  const [personas, setPersonas] = useState<Persona[]>([]);

  const togglePersona = (persona: Persona) => {
    const next = personas.includes(persona) ? personas.filter((chosen) => chosen !== persona) : [...personas, persona];
    setPersonas(next);
    if (next.length > 0) onModulesChange(modulesFor(next));
  };
  const toggleModule = (module: OnboardingModule) => {
    const next = new Set(modules);
    if (next.has(module)) next.delete(module);
    else next.add(module);
    onModulesChange(next);
  };

  return (
    <>
      <ActHeading title={text.title} lead={text.lead} />
      <p className="outfit-act__question">{text.personaQuestion}</p>
      <div className="outfit-act__personas">
        {PERSONAS.map((persona) => {
          const chosen = personas.includes(persona);
          return (
            <button
              key={persona}
              className={chosen ? "outfit-act__persona outfit-act__persona--chosen" : "outfit-act__persona"}
              type="button"
              aria-pressed={chosen}
              onClick={() => togglePersona(persona)}
            >
              <span className="outfit-act__persona-name">{text.personas[persona][0]}</span>
              <span className="outfit-act__persona-hint">{text.personas[persona][1]}</span>
              {chosen && <Check className="outfit-act__persona-check" size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="outfit-act__question">{text.stickersHint}</p>
      <div className="outfit-act__stickers" role="group" aria-label={text.stickers}>
        {MODULES.map((module) => {
          const Icon = MODULE_ICONS[module];
          const on = modules.has(module);
          return (
            <button
              key={module}
              className={on ? "outfit-act__sticker outfit-act__sticker--on" : "outfit-act__sticker"}
              type="button"
              aria-pressed={on}
              onClick={() => toggleModule(module)}
            >
              <Icon size={14} aria-hidden="true" />
              {text.modules[module]}
            </button>
          );
        })}
      </div>
    </>
  );
}
