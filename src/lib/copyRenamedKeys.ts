import { copyRenamedKeys } from "./renamedKeys";

if (typeof window !== "undefined") {
  try {
    copyRenamedKeys(window.localStorage);
  } catch {
  }
}
