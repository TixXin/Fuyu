import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let world;

function install({ wakes = true } = {}) {
  world = { contexts: [], fetched: [], elements: [], gains: [], started: 0 };
  globalThis.AudioContext = class {
    constructor() {
      this.state = "suspended";
      this.destination = {};
      world.contexts.push(this);
    }
    async resume() {
      if (wakes) this.state = "running";
    }
    async suspend() {
      this.state = "suspended";
    }
    async decodeAudioData(bytes) {
      return { bytes };
    }
    createBufferSource() {
      const source = { connect() {}, start: () => { world.started += 1; queueMicrotask(() => source.onended?.()); } };
      return source;
    }
    createGain() {
      const gain = { gain: { value: 1 }, connect() {} };
      world.gains.push(gain);
      return gain;
    }
  };
  globalThis.Audio = class {
    constructor(url) {
      this.url = url;
      this.volume = 1;
      world.elements.push(this);
    }
    async play() {}
  };
  globalThis.fetch = async (url) => {
    world.fetched.push(url);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
}

const saved = { AudioContext: globalThis.AudioContext, Audio: globalThis.Audio, fetch: globalThis.fetch };
let serial = 0;
async function load() {
  serial += 1;
  return import(`../../src/lib/sound/playSound.ts?case=${serial}`);
}

beforeEach(() => install());
afterEach(() => Object.assign(globalThis, saved));

test("a sound plays through the audio graph and never through a media element", async () => {
  const { playSound } = await load();
  await playSound("/sounds/complete.wav", 0.7);
  assert.equal(world.started, 1);
  assert.equal(world.gains[0].gain.value, 0.7);
  assert.equal(world.elements.length, 0);
});

test("the volume stays between silent and full", async () => {
  const { playSound } = await load();
  await playSound("/a.wav", 3);
  await playSound("/a.wav", -1);
  assert.deepEqual(world.gains.map((gain) => gain.gain.value), [1, 0]);
});

test("a file is fetched and decoded once until it is forgotten", async () => {
  const { playSound, forgetSound } = await load();
  await playSound("/a.wav");
  await playSound("/a.wav");
  assert.deepEqual(world.fetched, ["/a.wav"]);
  forgetSound("/a.wav");
  await playSound("/a.wav");
  assert.equal(world.fetched.length, 2);
  assert.equal(world.contexts.length, 1);
});

test("the audio device is let go shortly after the last sound ends", async () => {
  const { playSound } = await load();
  await playSound("/a.wav");
  assert.equal(world.contexts[0].state, "running");
  await wait(1700);
  assert.equal(world.contexts[0].state, "suspended");
});

test("a window that may not start the audio graph still makes the sound", async () => {
  install({ wakes: false });
  const { playSound } = await load();
  await playSound("/a.wav", 0.5);
  assert.equal(world.started, 0);
  assert.deepEqual(world.elements.map((element) => [element.url, element.volume]), [["/a.wav", 0.5]]);
});
