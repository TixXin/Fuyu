import { useState } from "react";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useTranslation } from "../../i18n";
import { DEFAULT_DEV_MATERIAL, DEV_MATERIALS, applyDevMaterial, type DevMaterial } from "./devMaterial";

export function DevMaterialPicker() {
  const text = useTranslation().settings.devBuild;
  const [material, setMaterial] = useState<DevMaterial>(DEFAULT_DEV_MATERIAL);
  const choose = (next: DevMaterial) => {
    setMaterial(next);
    void applyDevMaterial(next).catch((error: unknown) => console.error("Failed to change the sidebar material", error));
  };
  return (
    <SettingsSelect
      value={material}
      options={DEV_MATERIALS.map((value) => ({ value, label: text.materials[value] }))}
      ariaLabel={text.materialLabel}
      onChange={choose}
    />
  );
}
