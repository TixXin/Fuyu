import React, { useEffect, useState } from "../__shared/react.js";

const style = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  margin: "4px 8px",
  padding: "4px 8px",
  borderRadius: 8,
  font: "12px ui-monospace, monospace",
  color: "var(--island-text-secondary, rgba(255, 255, 255, 0.7))",
  background: "var(--island-surface-subtle, rgba(255, 255, 255, 0.06))",
};

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
    return React.createElement("div", { style, "data-plugin": "hello" }, React.createElement("span", null, greeting || "…"), React.createElement("span", null, count === null ? "" : `#${count}`));
  }
  ctx.slots.add("island.dev/v1", { id: "hello", component: Hello });
}
