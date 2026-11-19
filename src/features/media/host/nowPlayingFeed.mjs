export const CHANGE_SETTLE_MS = 150;

export function changeKey(state) {
  return JSON.stringify([
    state.available,
    state.playing,
    state.title,
    state.artist,
    state.album,
    state.sourceApp,
    state.durationMs,
    state.canSeek,
    state.canNext,
    state.canPrevious,
  ]);
}

export function createNowPlayingFeed({ read, emit, settleMs = CHANGE_SETTLE_MS }) {
  let timer = null;
  let reading = false;
  let again = false;
  let last = null;
  let stopped = false;

  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(flush, settleMs);
    timer.unref?.();
  };

  async function flush() {
    timer = null;
    if (reading) {
      again = true;
      return;
    }
    reading = true;
    try {
      const state = await read();
      if (stopped) return;
      const key = changeKey(state);
      if (key === last) return;
      last = key;
      emit(state);
    } catch {
      return;
    } finally {
      reading = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  }

  return {
    signal: schedule,
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
