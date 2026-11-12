import { invoke } from "@tauri-apps/api/core";
import type { AgentSoundEvent } from "./events";

export type SoundPack = {
  id: string;
  name: string;
  author: string;
  license: string;
  sounds: Partial<Record<AgentSoundEvent, string>>;
  fromPlugin?: boolean;
  nameEn?: string;
};

export function soundPackName(pack: SoundPack, locale: string) {
  return locale === "en" && pack.nameEn ? pack.nameEn : pack.name;
}

export type SoundPackImport = {
  name: string;
  author: string;
  license: string;
  files: { event: AgentSoundEvent; name: string; bytes: number[] }[];
};

export function listSoundPacks() {
  return invoke<SoundPack[]>("list_sound_packs");
}

export function importSoundPack(pack: SoundPackImport) {
  return invoke<SoundPack>("import_sound_pack", { pack });
}

export function removeSoundPack(id: string) {
  return invoke<void>("remove_sound_pack", { id });
}

export function openSoundPackFolder(id: string) {
  return invoke<void>("open_sound_pack_folder", { id });
}

export function readSoundPackFile(id: string, file: string) {
  return invoke<ArrayBuffer>("read_sound_pack_file", { id, file });
}
