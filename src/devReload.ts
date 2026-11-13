const MOUNTED = "fuyuMounted";

export function markMounted() {
  document.documentElement.dataset[MOUNTED] = "true";
}

if (import.meta.hot) {
  import.meta.hot.on("vite:afterUpdate", () => {
    if (document.documentElement.dataset[MOUNTED] !== "true") window.location.reload();
  });
}
