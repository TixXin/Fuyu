import { Service } from "@fuyu/plugin-base";
import { hostname } from "node:os";
import { greeting } from "./greeting.ts";

export default class Hello extends Service {
  static inject = ["clients"];
  count = 0;

  constructor(ctx: any) {
    super(ctx, "hello");
    ctx.clients.add("island", new URL("./island.js", import.meta.url).href);
    ctx.clients.handle("greet", (params: { who?: string } | undefined) => `${greeting(params?.who, process.pid)} on ${hostname()}`);
    ctx.setInterval(() => {
      this.count += 1;
      ctx.clients.publish("tick", this.count);
    }, 1000);
  }
}
