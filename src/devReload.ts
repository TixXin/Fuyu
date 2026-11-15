import type { RootOptions } from "react-dom/client";

const MOUNTED = "fuyuMounted";

export function markMounted() {
  document.documentElement.dataset[MOUNTED] = "true";
}

export const devRootOptions: RootOptions = import.meta.hot
  ? {
      onUncaughtError(error, info) {
        console.error("The window crashed and will reload on the next code change", error, info.componentStack);
        delete document.documentElement.dataset[MOUNTED];
      },
    }
  : {};

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", () => {
    if (document.documentElement.dataset[MOUNTED] !== "true") window.location.reload();
  });
}
