export default function apply(ctx) {
  async function renderPanel() {
    const summary = await ctx.host.call("summary");
    return `${summary.notes} notes, ${summary.words} words`;
  }
  ctx.slots.add("main.panel/v1", {
    id: "word-count",
    order: 10,
    component: renderPanel,
  });
}
