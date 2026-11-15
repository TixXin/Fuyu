import { Service } from "@fuyu/plugin-base";

export default class Hello extends Service {
  static inject = ["clients"];

  constructor(ctx) {
    super(ctx, "hello");
    this.count = 0;
    ctx.clients.add("island", new URL("./island.js", import.meta.url).href);
    ctx.clients.handle("greet", (params) => `hello ${params?.who ?? "there"}, from the plugin host (pid ${process.pid})`);
    ctx.setInterval(() => {
      this.count += 1;
      ctx.clients.publish("tick", this.count);
    }, 1000);
  }
}
