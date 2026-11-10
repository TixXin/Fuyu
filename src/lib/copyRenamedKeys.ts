// Imported first by main.tsx: modules read their settings when they load, so the
// keys from before the rename must be in place before any other import runs.
import { copyRenamedKeys } from "./renamedKeys";

if (typeof window !== "undefined") {
  try {
    copyRenamedKeys(window.localStorage);
  } catch {
    // window.localStorage itself throws when storage is blocked.
  }
}
