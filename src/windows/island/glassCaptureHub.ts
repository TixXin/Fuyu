export type GlassCaptureData = ArrayBuffer | number[];
type Listener = (data: GlassCaptureData) => void;

export type GlassCaptureJoin<R> = { started: Promise<R>; leave: () => void };

export function createGlassCaptureHub<R>(stop: () => void) {
  const listeners = new Set<Listener>();
  let started: Promise<R> | null = null;
  let last: GlassCaptureData | null = null;
  let session = 0;

  const join = (listener: Listener, start: (deliver: Listener) => Promise<R>): GlassCaptureJoin<R> => {
    listeners.add(listener);
    if (!started) {
      const id = ++session;
      started = start((data) => {
        if (id !== session) return;
        last = data;
        for (const each of listeners) each(data);
      });
    } else if (last) {
      listener(last);
    }
    let left = false;
    return {
      started,
      leave: () => {
        if (left) return;
        left = true;
        listeners.delete(listener);
        if (listeners.size > 0) return;
        session += 1;
        started = null;
        last = null;
        stop();
      },
    };
  };

  return { join };
}
