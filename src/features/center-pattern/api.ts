import { invoke } from "@tauri-apps/api/core";

export type PetSource = "app" | "codex";

export type PetInfo = { id: string; displayName: string; source: PetSource };

const spritesheets = new Map<string, Promise<string>>();
const failedSheets = new Set<string>();

export function listPets(): Promise<PetInfo[]> {
  spritesheets.clear();
  failedSheets.clear();
  return invoke<PetInfo[]>("list_pets");
}

export function getPetSpritesheet(id: string, { retryFailed = false } = {}): Promise<string> {
  if (retryFailed && failedSheets.delete(id)) spritesheets.delete(id);
  let sheet = spritesheets.get(id);
  if (!sheet) {
    sheet = invoke<string>("get_pet_spritesheet", { id });
    spritesheets.set(id, sheet);
    sheet.catch(() => failedSheets.add(id));
  }
  return sheet;
}
