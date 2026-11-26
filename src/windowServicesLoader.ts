import { serviceFeaturesForWindow } from "./windowServicesMap";

const serviceModules = import.meta.glob("./features/*/plugin/services.ts");

export async function loadWindowServicesFor(kind: string | null): Promise<void> {
  const features = serviceFeaturesForWindow(kind);
  await Promise.all(
    features.map((feature) => {
      const load = serviceModules[`./features/${feature}/plugin/services.ts`];
      return load ? load() : Promise.resolve();
    }),
  );
}
