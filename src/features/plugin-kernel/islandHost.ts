export type Unlisten = () => void;

export type IslandHost = {
  listenHover(handler: (inside: boolean) => void): Promise<Unlisten>;
  listenOutsideClick(handler: () => void): Promise<Unlisten>;
  setOutsideClickWatch(watch: boolean): Promise<void>;
};
