export type Unlisten = () => void;

export type IslandRect = { x: number; y: number; width: number; height: number };

export type IslandHost = {
  listenHover(handler: (inside: boolean) => void): Promise<Unlisten>;
  listenOutsideClick(handler: () => void): Promise<Unlisten>;
  setOutsideClickWatch(watch: boolean): Promise<void>;
  listenBannerHover(handler: (inside: boolean) => void): Promise<Unlisten>;
  setBannerRect(rect: IslandRect | null): Promise<void>;
};
