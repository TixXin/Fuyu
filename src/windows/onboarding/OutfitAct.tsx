import { useState, type DragEvent } from "react";
import { Check } from "lucide-react";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { ActHeading } from "./ActHeading";
import { MiniDesk } from "./MiniDesk";
import { MiniIsland, MODULE_ICONS } from "./MiniIsland";
import { MODULES, PERSONAS, modulesFor, type OnboardingModule, type Persona } from "./personas";
import "./OutfitAct.css";

const STICKER_TYPE = "application/x-fuyu-module";

/**
 * Act 3: one question picks a set of modules; the stickers below then add or remove one each,
 * by a click or by dragging one onto the island, whose bar shows an icon per module.
 */
export function OutfitAct({ shown, modules, onModulesChange }: {
  shown: IslandSettings;
  modules: ReadonlySet<OnboardingModule>;
  onModulesChange: (modules: ReadonlySet<OnboardingModule>) => void;
}) {
  const t = useTranslation();
  const text = t.onboarding.outfit;
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [dropping, setDropping] = useState(false);

  const togglePersona = (persona: Persona) => {
    const next = personas.includes(persona) ? personas.filter((chosen) => chosen !== persona) : [...personas, persona];
    setPersonas(next);
    if (next.length > 0) onModulesChange(modulesFor(next));
  };
  const setModule = (module: OnboardingModule, on: boolean) => {
    const next = new Set(modules);
    if (on) next.add(module);
    else next.delete(module);
    onModulesChange(next);
  };
  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDropping(false);
    const module = MODULES.find((known) => known === event.dataTransfer.getData(STICKER_TYPE));
    if (module) setModule(module, true);
  };

  return (
    <>
      <MiniDesk
        island={
          <MiniIsland
            settings={shown}
            modules={modules}
            label={t.onboarding.islandName}
            highlight={dropping}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(STICKER_TYPE)) return;
              event.preventDefault();
              setDropping(true);
            }}
            onDragLeave={() => setDropping(false)}
            onDrop={drop}
          />
        }
      />
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
              draggable
              aria-pressed={on}
              onClick={() => setModule(module, !on)}
              onDragStart={(event) => {
                event.dataTransfer.setData(STICKER_TYPE, module);
                event.dataTransfer.effectAllowed = "copy";
              }}
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
