/// <reference types="vite/client" />

declare module "lucide-react/dist/esm/icons/index.mjs" {
  const icons: Record<string, unknown>;
  export = icons;
}

declare module "virtual:fuyu-release-dates" {
  const dates: Record<string, string>;
  export default dates;
}
