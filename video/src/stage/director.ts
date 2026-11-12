export type Cue = { at: number; run: () => void | Promise<void> };

export type Director = {
  at: (ms: number, run: Cue["run"]) => void;
  play: () => void;
  cues: () => readonly Cue[];
};

export function createDirector(): Director {
  const cues: Cue[] = [];
  let started = false;
  return {
    at: (ms, run) => { cues.push({ at: ms, run }); },
    cues: () => cues,
    play: () => {
      if (started) return;
      started = true;
      [...cues].sort((a, b) => a.at - b.at).forEach((cue) => {
        window.setTimeout(() => {
          void Promise.resolve().then(cue.run).catch((error) => console.error(`cue @${cue.at}`, error));
        }, cue.at);
      });
    },
  };
}
