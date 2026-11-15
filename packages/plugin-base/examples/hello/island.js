import React, { useEffect, useState } from "../__shared/react.js";

const style = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  margin: "4px 8px",
  padding: "4px 8px",
  borderRadius: "var(--fuyu-plugin-radius)",
  font: "12px ui-monospace, monospace",
  color: "var(--fuyu-plugin-text-secondary)",
  background: "var(--fuyu-plugin-surface)",
  minWidth: 0,
  whiteSpace: "nowrap",
};
const greetingStyle = { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" };
const countStyle = { flexShrink: 0, color: "var(--fuyu-plugin-text-muted)" };

export default function apply(ctx) {
  function Hello() {
    const [count, setCount] = useState(null);
    const [greeting, setGreeting] = useState("");
    useEffect(() => {
      const off = ctx.host.on("tick", setCount);
      ctx.host.call("greet", { who: "island" }).then(setGreeting, (error) => setGreeting(String(error.message)));
      return () => {
        void off();
      };
    }, []);
    return React.createElement("div", { style, "data-plugin": "hello" }, React.createElement("span", { style: greetingStyle }, greeting || "…"), React.createElement("span", { style: countStyle }, count === null ? "" : `#${count}`));
  }
  ctx.slots.add("island.dev/v1", { id: "hello", component: Hello });
}
