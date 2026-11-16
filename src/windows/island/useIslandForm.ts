import { useEffect } from "react";
import type { IslandForm } from "../../lib/settings/types";
import "./IslandPill.css";

export function useIslandForm(form: IslandForm) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.islandForm = form;
    return () => {
      delete root.dataset.islandForm;
    };
  }, [form]);
}
