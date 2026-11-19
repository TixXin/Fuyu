type Preview = { mediaControls?: boolean; iconUrl?: string | null };

type Art = { cover: string | null; sourceIcon: string | null } | null;

export function withTrackArt<T extends Preview>(preview: T | null, art: Art): T | null {
  if (!preview?.mediaControls) return preview;
  return { ...preview, iconUrl: art?.cover ?? art?.sourceIcon ?? preview.iconUrl };
}
