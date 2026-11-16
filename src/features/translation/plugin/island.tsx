import { Languages } from "lucide-react";
import { useTranslation } from "../../../i18n";
import { defineSlot, type IslandHeaderMeta, type IslandPageMeta } from "../../plugin-kernel/slots";
import { TranslationPanel } from "../TranslationPanel";
import { islandPage } from "./page.ts";
import { OWNER } from "./owner.ts";

type TranslationPageProps = { mode: string; onOpenSettings: (section: "translation") => void };

const pageSlot = defineSlot<TranslationPageProps, IslandPageMeta<Readonly<Record<string, unknown>>>>("island.page/v1");

function TranslationPage({ mode, onOpenSettings }: TranslationPageProps) {
  return <TranslationPanel isOpen={mode === "expanded"} onOpenSettings={() => onOpenSettings("translation")} />;
}

type HeaderContext = {
  page: string;
  features: { translation: boolean };
  withShortcut: (label: string, target: "translation") => string;
  onOpenTranslator: (() => void) | null;
};

const headerSlot = defineSlot<HeaderContext, IslandHeaderMeta<HeaderContext>>("island.header/v1");

function TranslateButton({ page, features, withShortcut, onOpenTranslator }: HeaderContext) {
  const t = useTranslation();
  return (
    <button
      className={`icon-button island-translate-button${page === "translation" ? " island-translate-button--active" : ""}`}
      type="button"
      aria-label={features.translation ? withShortcut(t.translator.title, "translation") : t.translator.title}
      aria-pressed={features.translation ? page === "translation" : undefined}
      onClick={(event) => {
        event.stopPropagation();
        onOpenTranslator?.();
      }}
    >
      <Languages size={16} strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
    </button>
  );
}

pageSlot.add({ ...islandPage, component: TranslationPage }, OWNER);
headerSlot.add({ id: "translator", order: 30, enabled: ({ onOpenTranslator }) => Boolean(onOpenTranslator), component: TranslateButton }, OWNER);
