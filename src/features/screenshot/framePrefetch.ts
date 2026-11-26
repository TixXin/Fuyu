export type SharedFrame = {
  id: number;
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
};

type SharedBufferEvent = Event & {
  additionalData?: unknown;
  getBuffer: () => ArrayBuffer;
};

type WebView2Host = {
  addEventListener: (type: "sharedbufferreceived", listener: (event: SharedBufferEvent) => void) => void;
  releaseBuffer: (buffer: ArrayBuffer) => void;
};

export type FrameLoader<TSession> = {
  getSession: () => Promise<TSession | null>;
  getFrame: () => Promise<ArrayBuffer>;
};

const SHARED_WAIT_MS = 1500;

export function createFramePrefetcher<TSession extends { id: number; width: number; height: number }>(
  loader: FrameLoader<TSession>,
) {
  const sharedFrames = new Map<number, SharedFrame>();
  const sharedWaiters = new Map<number, ((frame: SharedFrame) => void)[]>();
  let listenerInstalled = false;
  let prefetchedSession: Promise<TSession | null> | null = null;
  let prefetchedFrame: Promise<ArrayBuffer> | null = null;
  let resolvedSession: TSession | null = null;
  let resolvedRawFrame: Uint8ClampedArray<ArrayBuffer> | null = null;

  const webview2Host = (): WebView2Host | null => {
    if (typeof window === "undefined") return null;
    const host = (window as Window & { chrome?: { webview?: Partial<WebView2Host> } }).chrome?.webview;
    if (!host || typeof host.addEventListener !== "function" || typeof host.releaseBuffer !== "function") {
      return null;
    }
    return host as WebView2Host;
  };

  const safeJsonParse = (raw: string): unknown => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const parseSharedMeta = (raw: unknown): { id: number; width: number; height: number } | null => {
    const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.id !== "number" || typeof record.width !== "number" || typeof record.height !== "number") {
      return null;
    }
    return { id: record.id, width: record.width, height: record.height };
  };

  const deliverSharedFrame = (frame: SharedFrame) => {
    const waiters = sharedWaiters.get(frame.id);
    if (waiters && waiters.length > 0) {
      sharedWaiters.delete(frame.id);
      for (const resolve of waiters) resolve(frame);
      return;
    }
    if (sharedFrames.size >= 4) {
      const oldest = sharedFrames.keys().next().value;
      if (oldest !== undefined) sharedFrames.delete(oldest);
    }
    sharedFrames.set(frame.id, frame);
  };

  const installSharedBufferListener = () => {
    if (listenerInstalled) return;
    const host = webview2Host();
    if (!host) return;
    listenerInstalled = true;
    host.addEventListener("sharedbufferreceived", (event) => {
      const buffer = event.getBuffer();
      try {
        const meta = parseSharedMeta(event.additionalData);
        if (!meta || buffer.byteLength === 0) return;
        const copy = new Uint8ClampedArray(new ArrayBuffer(buffer.byteLength));
        copy.set(new Uint8Array(buffer));
        deliverSharedFrame({ id: meta.id, width: meta.width, height: meta.height, data: copy });
      } finally {
        host.releaseBuffer(buffer);
      }
    });
  };

  const waitForSharedFrame = (id: number): Promise<SharedFrame | null> => {
    const ready = sharedFrames.get(id);
    if (ready) {
      sharedFrames.delete(id);
      return Promise.resolve(ready);
    }
    return new Promise((resolve) => {
      const finish = (frame: SharedFrame) => {
        window.clearTimeout(timer);
        resolve(frame);
      };
      const timer = window.setTimeout(() => {
        const list = sharedWaiters.get(id);
        if (list) {
          const next = list.filter((entry) => entry !== finish);
          if (next.length > 0) sharedWaiters.set(id, next);
          else sharedWaiters.delete(id);
        }
        resolve(null);
      }, SHARED_WAIT_MS);
      const list = sharedWaiters.get(id) ?? [];
      list.push(finish);
      sharedWaiters.set(id, list);
    });
  };

  return {
    prefetch() {
      installSharedBufferListener();
      if (!prefetchedSession) {
        prefetchedSession = loader.getSession().then((session) => {
          if (session) resolvedSession = session;
          return session;
        });
      }
      if (!prefetchedFrame) {
        prefetchedFrame = loader.getFrame().then((buffer) => {
          if (buffer.byteLength > 0) resolvedRawFrame = new Uint8ClampedArray(buffer);
          return buffer;
        });
      }
    },
    reset() {
      prefetchedSession = null;
      prefetchedFrame = null;
      resolvedSession = null;
      resolvedRawFrame = null;
    },
    peekSession(): TSession | null {
      return resolvedSession;
    },
    peekFrame(id: number, width: number, height: number): Uint8ClampedArray<ArrayBuffer> | null {
      const expected = width * height * 4;
      if (expected <= 0) return null;
      const shared = sharedFrames.get(id);
      if (shared && shared.width === width && shared.height === height && shared.data.byteLength === expected) {
        return shared.data;
      }
      if (resolvedSession?.id === id && resolvedRawFrame && resolvedRawFrame.byteLength === expected) {
        return resolvedRawFrame;
      }
      return null;
    },
    fetchSession(): Promise<TSession | null> {
      return prefetchedSession ?? loader.getSession();
    },
    async fetchFrame(id: number, width: number, height: number): Promise<Uint8ClampedArray<ArrayBuffer>> {
      installSharedBufferListener();
      const expected = width * height * 4;
      const ready = sharedFrames.get(id);
      if (ready && ready.width === width && ready.height === height && ready.data.byteLength === expected) {
        sharedFrames.delete(id);
        return ready.data;
      }
      if (resolvedSession?.id === id && resolvedRawFrame && resolvedRawFrame.byteLength === expected) {
        const data = resolvedRawFrame;
        resolvedRawFrame = null;
        prefetchedFrame = null;
        return data;
      }
      const pending = prefetchedFrame;
      prefetchedFrame = null;
      let buffer = await (pending ?? loader.getFrame());
      if (buffer.byteLength === 0) {
        const shared = await waitForSharedFrame(id);
        if (shared && shared.width === width && shared.height === height && shared.data.byteLength === expected) {
          return shared.data;
        }
        buffer = await loader.getFrame();
        if (buffer.byteLength === 0) {
          const retried = await waitForSharedFrame(id);
          if (retried) return retried.data;
          throw new Error("Screenshot frame was empty.");
        }
      }
      return new Uint8ClampedArray(buffer);
    },
  };
}
