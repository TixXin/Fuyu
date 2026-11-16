import { defineService } from "../define.mjs";

export const mediaV1 = defineService("media/v1", {
  methods: { nowPlaying: true, playPause: true, next: true, previous: true, seek: true },
});
