type AudioContextCtor = typeof AudioContext;

const IDLE_MS = 1500;
const RESUME_WAIT_MS = 400;

let context: AudioContext | null = null;
let playing = 0;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const buffers = new Map<string, Promise<AudioBuffer>>();

function audioContext(): AudioContext | null {
  const scope = globalThis as typeof globalThis & { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) return null;
  if (!context || context.state === "closed") {
    context = new Ctor();
    buffers.clear();
  }
  return context;
}

function decoded(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  let buffer = buffers.get(url);
  if (!buffer) {
    buffer = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`The sound file answered ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => ctx.decodeAudioData(bytes));
    buffer.catch(() => buffers.delete(url));
    buffers.set(url, buffer);
  }
  return buffer;
}

function rest(ctx: AudioContext) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (playing === 0 && ctx.state === "running") void ctx.suspend().catch(() => undefined);
  }, IDLE_MS);
}

export function clampVolume(volume: number): number {
  return Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
}

const isRunning = (ctx: AudioContext) => ctx.state === "running";

async function awake(ctx: AudioContext): Promise<boolean> {
  if (isRunning(ctx)) return true;
  await Promise.race([
    ctx.resume().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, RESUME_WAIT_MS)),
  ]);
  return isRunning(ctx);
}

async function playElement(url: string, volume: number): Promise<void> {
  const audio = new Audio(url);
  audio.volume = clampVolume(volume);
  await audio.play();
}

export async function playSound(url: string, volume = 1): Promise<void> {
  const ctx = audioContext();
  if (!ctx) return playElement(url, volume);
  clearTimeout(idleTimer);
  playing += 1;
  try {
    const buffer = await decoded(ctx, url);
    if (!(await awake(ctx))) return await playElement(url, volume);
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.value = clampVolume(volume);
    source.connect(gain);
    gain.connect(ctx.destination);
    await new Promise<void>((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  } finally {
    playing -= 1;
    if (playing === 0) rest(ctx);
  }
}

export function forgetSound(url: string) {
  buffers.delete(url);
}
