import { defineService } from "../define.mjs";

export const fileShelfV1 = defineService("file-shelf/v1", {
  methods: { list: true, add: true },
});
